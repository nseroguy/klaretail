'use client';

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Store, 
  ChefHat, 
  Bike, 
  Clock, 
  CheckCircle2, 
  RefreshCw, 
  AlertCircle, 
  Phone, 
  Power, 
  Utensils, 
  PackageCheck, 
  Flame,
  Tag,
  Wallet
} from 'lucide-react';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface VendorOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  deliveryPin: string;
  pickupCode: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  riderName?: string;
  riderPhone?: string;
  riderPlate?: string;
  items: OrderItem[];
}

interface ProductItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  isAvailable: boolean;
}

export default function VendorOrdersPage() {
  const router = useRouter();
  const [vendor, setVendor] = useState<any>(null);
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [menuItems, setMenuItems] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingStore, setTogglingStore] = useState(false);
  const [activeTab, setActiveTab] = useState<'KITCHEN' | 'MENU' | 'DELIVERED'>('KITCHEN');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchVendorData = async () => {
    setRefreshing(true);
    setActionError(null);
    try {
      const res = await fetch('/api/vendor/orders');
      if (res.status === 401 || res.status === 403) {
        router.push('/vendor/login');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setVendor(data.vendor);
        setOrders(data.orders || []);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to sync kitchen queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await fetch('/api/vendor/menu');
      const data = await res.json();
      if (data.success) {
        setMenuItems(data.products || []);
      }
    } catch (err) {
      console.error('Failed to load menu items:', err);
    }
  };

  useEffect(() => {
    fetchVendorData();
    fetchMenu();
    const interval = setInterval(fetchVendorData, 10000);
    return () => clearInterval(interval);
  }, []);

  // 1. Toggle Store Open / Close
  const handleToggleStoreAvailability = async () => {
    if (!vendor) return;
    setTogglingStore(true);
    setActionError(null);
    const newStatus = !vendor.isAcceptingOrders;
    try {
      const res = await fetch('/api/vendor/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAcceptingOrders: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update store status.');
      setVendor((prev: any) => ({ ...prev, isAcceptingOrders: newStatus }));
      setActionSuccess(`Store status changed to: ${newStatus ? 'Accepting Orders' : 'Paused / Closed'}`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setTogglingStore(false);
    }
  };

  // 2. Advance Kitchen Prep Stage
  const handleAdvanceStage = async (orderId: string, nextStatus: string) => {
    setActionError(null);
    try {
      const res = await fetch('/api/vendor/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, targetStatus: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Stage transition failed.');
      
      setOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, status: nextStatus } : ord))
      );
      setActionSuccess(`Order status updated to ${nextStatus.replace('_', ' ')}.`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  // 3. Toggle Dish Availability (86 item)
  const handleToggleDish = async (productId: string, currentAvailable: boolean) => {
    try {
      const res = await fetch('/api/vendor/menu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, isAvailable: !currentAvailable }),
      });
      const data = await res.json();
      if (data.success) {
        setMenuItems((prev) =>
          prev.map((item) => (item.id === productId ? { ...item, isAvailable: !currentAvailable } : item))
        );
      }
    } catch (err) {
      console.error('Failed to toggle dish availability:', err);
    }
  };

  const activeOrders = orders.filter((o) => o.status !== 'delivered');
  const pastOrders = orders.filter((o) => o.status === 'delivered');

  return (
    <div className="min-h-screen bg-[#0C0F0E] text-[#ECEEEB] font-sans pb-16">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#1C2420] bg-[#121714]/90 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-400">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-white">{vendor?.name || 'Vendor Merchant Terminal'}</h1>
                
                {/* Store Open / Close Status Badge */}
                <button
                  onClick={handleToggleStoreAvailability}
                  disabled={togglingStore}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border transition ${
                    vendor?.isAcceptingOrders
                      ? 'bg-emerald-950/80 border-emerald-600 text-emerald-400 hover:bg-emerald-900'
                      : 'bg-red-950/80 border-red-600 text-red-400 hover:bg-red-900'
                  }`}
                >
                  <Power className="h-3 w-3" />
                  <span>{vendor?.isAcceptingOrders ? 'Accepting Orders (Click to Pause)' : 'Store Paused (Click to Open)'}</span>
                </button>
              </div>
              <p className="text-xs text-neutral-400 font-mono">Kitchen Operations Console • Kampala, UG</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
                      <Link
            href="/vendor/wallet"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Store Wallet</span>
          </Link>
<button
              onClick={fetchVendorData}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-xl border border-[#232D28] bg-[#161D19] px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-[#1E2722] transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
              <span>Sync</span>
            </button>
            <button
              onClick={() => {
                document.cookie = 'staff_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
                router.push('/vendor/login');
              }}
              className="rounded-xl border border-[#2E3B33] bg-[#1A221E] px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-6 pt-6 space-y-6">
        
        {/* Metric Badges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[#1D2521] bg-[#131916] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Active Kitchen Tickets</p>
            <p className="mt-2 text-3xl font-black font-mono text-emerald-400">{activeOrders.length}</p>
            <p className="text-[11px] text-neutral-500 mt-1">Pending prep, readying, or courier pickup</p>
          </div>

          <div className="rounded-2xl border border-[#1D2521] bg-[#131916] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Completed Orders</p>
            <p className="mt-2 text-3xl font-black font-mono text-white">{pastOrders.length}</p>
            <p className="text-[11px] text-neutral-500 mt-1">Fulfilled today</p>
          </div>

          <div className="rounded-2xl border border-[#1D2521] bg-[#131916] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Store Switch</p>
            <div className="mt-2 flex items-center justify-between">
              <span className={`text-base font-bold ${vendor?.isAcceptingOrders ? 'text-emerald-400' : 'text-red-400'}`}>
                {vendor?.isAcceptingOrders ? 'Live Accepting' : 'Paused / Rush Hour'}
              </span>
              <button
                onClick={handleToggleStoreAvailability}
                disabled={togglingStore}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  vendor?.isAcceptingOrders
                    ? 'bg-red-900/60 text-red-200 hover:bg-red-800'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
              >
                {vendor?.isAcceptingOrders ? 'Pause Store' : 'Open Store'}
              </button>
            </div>
          </div>
        </div>

        {actionError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Tab Filters */}
        <div className="flex gap-2 border-b border-[#1E2622] pb-2">
          <button
            onClick={() => setActiveTab('KITCHEN')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'KITCHEN'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ChefHat className="h-4 w-4" /> Kitchen Display ({activeOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('MENU')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'MENU'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Utensils className="h-4 w-4" /> Menu & 86 Items ({menuItems.length})
          </button>
          <button
            onClick={() => setActiveTab('DELIVERED')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'DELIVERED'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" /> Fulfillment History ({pastOrders.length})
          </button>
        </div>

        {/* TAB 1: KITCHEN DISPLAY */}
        {activeTab === 'KITCHEN' && (
          <div className="space-y-4">
            {activeOrders.length === 0 ? (
              <div className="rounded-3xl border border-[#1D2521] bg-[#121714] p-12 text-center text-sm text-neutral-500">
                <ChefHat className="mx-auto h-10 w-10 text-neutral-600 mb-3" />
                All caught up! No food orders currently in preparation queue.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="rounded-3xl border border-[#1E2722] bg-[#131916] p-5 shadow-xl space-y-4 flex flex-col justify-between"
                  >
                    <div>
                      {/* Order Header & Pickup Code */}
                      <div className="flex items-start justify-between border-b border-[#1E2622] pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-black text-emerald-400">
                              #{ord.orderNumber}
                            </span>
                            <span className="rounded bg-emerald-950 border border-emerald-700/60 px-2 py-0.5 font-mono text-xs font-bold text-emerald-300">
                              Pickup Code: {ord.pickupCode}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 mt-1">
                            Placed at: {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="font-mono text-base font-bold text-white">
                            UGX {Number(ord.totalAmount).toLocaleString()}
                          </span>
                          <p className="text-[10px] font-semibold text-neutral-400 uppercase">Cash on Delivery</p>
                        </div>
                      </div>

                      {/* Itemized Food Breakdown */}
                      <div className="my-3 rounded-2xl bg-[#0F1411] p-3.5 border border-[#1A221D] space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                          <Utensils className="h-3.5 w-3.5 text-emerald-400" /> Order Items ({ord.items?.length || 0})
                        </p>
                        <div className="divide-y divide-[#18211B]">
                          {ord.items?.map((item) => (
                            <div key={item.id} className="flex justify-between items-center py-1.5 text-xs">
                              <span className="font-semibold text-white">
                                <span className="font-mono font-bold text-emerald-400 mr-2">{item.quantity}x</span>
                                {item.name}
                              </span>
                              <span className="font-mono text-neutral-400">
                                UGX {Number(item.totalPrice).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Customer & Drop-off */}
                      <div className="text-xs text-neutral-300 space-y-1">
                        <p className="font-semibold text-white">{ord.customerName} ({ord.customerPhone})</p>
                        <p className="text-neutral-400">{ord.deliveryAddress}</p>
                      </div>

                      {/* Courier Handshake Info */}
                      {ord.riderName ? (
                        <div className="mt-3 rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Bike className="h-5 w-5 text-emerald-400" />
                            <div>
                              <p className="text-xs font-bold text-white">{ord.riderName}</p>
                              <p className="text-[10px] font-mono text-neutral-400">Plate: {ord.riderPlate || 'Boda'}</p>
                            </div>
                          </div>
                          {ord.riderPhone && (
                            <a
                              href={`tel:${ord.riderPhone}`}
                              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-500"
                            >
                              <Phone className="h-3 w-3" /> Call
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-xl border border-dashed border-[#28332C] bg-[#0E1210] p-2.5 text-center text-[11px] text-neutral-500">
                          Awaiting courier dispatch assignment
                        </div>
                      )}
                    </div>

                    {/* Interactive Prep Stage Pipeline Buttons */}
                    <div className="pt-3 border-t border-[#1E2622] flex gap-2">
                      {ord.status === 'created' && (
                        <button
                          onClick={() => handleAdvanceStage(ord.id, 'rider_assigned')}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 text-xs transition"
                        >
                          <Flame className="h-4 w-4" /> Start Cooking / Accept
                        </button>
                      )}

                      {ord.status === 'rider_assigned' && (
                        <button
                          onClick={() => handleAdvanceStage(ord.id, 'dispatched')}
                          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 text-xs transition"
                        >
                          <PackageCheck className="h-4 w-4" /> Mark Food Ready / Handed to Courier
                        </button>
                      )}

                      {ord.status !== 'created' && ord.status !== 'rider_assigned' && (
                        <span className="w-full text-center text-xs font-bold py-2 rounded-xl bg-neutral-800 text-neutral-400 uppercase">
                          {ord.status.replace('_', ' ')}
                        </span>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MENU & 86 (SOLD OUT) MANAGEMENT */}
        {activeTab === 'MENU' && (
          <div className="rounded-3xl border border-[#1E2722] bg-[#131916] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E2622] pb-3">
              <div>
                <h2 className="text-sm font-bold text-white">Live Menu Availability (86 Stock Management)</h2>
                <p className="text-xs text-neutral-400">Toggle items on or off when ingredients run out during rush hours.</p>
              </div>
            </div>

            <div className="divide-y divide-[#1A231E]">
              {menuItems.map((dish) => (
                <div key={dish.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-bold ${dish.isAvailable ? 'text-white' : 'line-through text-neutral-500'}`}>
                      {dish.name}
                    </p>
                    <p className="text-xs font-mono text-emerald-400">UGX {Number(dish.price).toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => handleToggleDish(dish.id, dish.isAvailable)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      dish.isAvailable
                        ? 'bg-neutral-800 text-neutral-300 hover:bg-red-950/60 hover:text-red-300'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    {dish.isAvailable ? 'Mark Sold Out (86)' : 'Mark Available'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: DELIVERED / FULFILLED TAB */}
        {activeTab === 'DELIVERED' && (
          <div className="space-y-2">
            {pastOrders.map((ord) => (
              <div
                key={ord.id}
                className="flex items-center justify-between rounded-2xl border border-[#1B231F] bg-[#121614] px-4 py-3 text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-emerald-400">#{ord.orderNumber}</span>
                  <span className="text-neutral-400 ml-2">{ord.customerName}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-white">UGX {Number(ord.totalAmount).toLocaleString()}</span>
                  <span className="rounded bg-emerald-950 text-emerald-400 px-2 py-0.5 font-semibold text-[10px]">
                    Delivered
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
