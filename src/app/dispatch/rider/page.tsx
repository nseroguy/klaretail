'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import HandoverModal from '@/components/dispatch/HandoverModal';
import B2BHandoverModal from '@/components/dispatch/B2BHandoverModal';

interface RiderProfile {
  id: string;
  name: string;
  phone: string;
  vehiclePlate: string;
  walletBalance: string | number;
  maxCashLimit: string | number;
  isActive: boolean;
  isAvailable: boolean;
  capacityTier?: string;
}

interface AssignedOrder {
  id: string;
  orderNumber: string;
  orderType?: 'B2C' | 'B2B';
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  vendorName: string;
  vendorAddress?: string;
  pickupCode?: string;
  supplierPickupPin?: string;
  deliveryPin?: string;
  totalAmount: number;
  codAmountDue: string | number;
  paymentMethod: string;
  status: string;
  requiredVehicleTier?: string;
  cratesCount?: number;
  createdAt: string;
}

export default function RiderDashboardPage() {
  const router = useRouter();
  const [rider, setRider] = useState<RiderProfile | null>(null);
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingShift, setTogglingShift] = useState(false);
  
  // Modals
  const [selectedOrder, setSelectedOrder] = useState<AssignedOrder | null>(null);
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);
  const [selectedB2BOrder, setSelectedB2BOrder] = useState<AssignedOrder | null>(null);
  const [isB2BModalOpen, setIsB2BModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const loadRiderData = async () => {
    try {
      const res = await fetch('/api/dispatch/rider-view');
      if (res.status === 401) {
        router.push('/dispatch/login');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setRider(data.rider);
        setOrders(data.assignedOrders || []);
      }
    } catch (err) {
      console.error('Failed to fetch courier dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRiderData();
    const interval = setInterval(loadRiderData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleShift = async () => {
    if (!rider) return;
    setTogglingShift(true);
    try {
      const res = await fetch('/api/dispatch/toggle-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riderId: rider.id, isAvailable: !rider.isAvailable }),
      });
      const data = await res.json();
      if (data.success) {
        setRider((prev) => prev ? { ...prev, isAvailable: !prev.isAvailable } : null);
      }
    } catch (err) {
      console.error('Failed to toggle shift:', err);
    } finally {
      setTogglingShift(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/dispatch/logout', { method: 'POST' });
    } catch {}
    router.push('/dispatch/login');
  };

  // Completed check: handles both lowercase B2C ('delivered', 'completed') and B2B ('DELIVERED_AND_RECEIVED')
  const isOrderCompleted = (status: string) => {
    const s = String(status || '').toUpperCase();
    return s === 'DELIVERED' || s === 'DELIVERED_AND_RECEIVED' || s === 'COMPLETED' || s === 'CANCELLED';
  };

  const activeOrders = orders.filter((o) => !isOrderCompleted(o.status));
  const completedOrders = orders.filter((o) => isOrderCompleted(o.status));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-white font-mono text-sm">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          Loading KlaRetail Courier Terminal...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg">
            🏍️
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">{rider?.name || 'Courier'}</h1>
            <p className="text-[11px] font-mono text-zinc-400">{rider?.vehiclePlate} • {rider?.capacityTier || 'BODA'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleShift}
            disabled={togglingShift}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
              rider?.isAvailable
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}
          >
            {rider?.isAvailable ? '● On Duty' : '○ Off Duty'}
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white transition text-xs"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-4">
        {notification && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300 flex justify-between items-center">
            <span>{notification}</span>
            <button onClick={() => setNotification(null)} className="text-zinc-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Active Dispatches */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Active Dispatches ({activeOrders.length})
            </h2>
            <button onClick={loadRiderData} className="text-xs text-emerald-400 hover:underline">
              Refresh
            </button>
          </div>

          {activeOrders.length === 0 ? (
            <div className="rounded-2xl border border-zinc-900 bg-zinc-900/40 p-8 text-center text-zinc-500">
              <p className="text-sm">No dispatches currently assigned.</p>
              <p className="text-xs mt-1 text-zinc-600">Assigned deliveries will appear here automatically.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeOrders.map((ord) => {
                const isB2B = ord.orderType === 'B2B';
                return (
                  <div
                    key={ord.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 space-y-3 shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-white">#{ord.orderNumber}</span>
                        {isB2B ? (
                          <span className="rounded-full bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300 uppercase">
                            B2B • {ord.cratesCount || 0} Crates
                          </span>
                        ) : (
                          <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 uppercase">
                            B2C Retail
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] font-bold uppercase ${
                        ord.status === 'IN_TRANSIT' ? 'text-cyan-400' : 'text-amber-400'
                      }`}>
                        {ord.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Routing Details */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-zinc-950/70 p-2.5 border border-zinc-800/60">
                        <span className="text-[10px] text-zinc-500 font-semibold uppercase block">
                          {isB2B ? 'Step 1: Supplier Dock' : 'Step 1: Pickup'}
                        </span>
                        <p className="text-zinc-200 font-medium truncate mt-0.5">{ord.vendorName}</p>
                        <span className="font-mono text-zinc-400 text-[11px]">
                          {isB2B ? 'Require Vendor PIN' : `Code: ${ord.pickupCode || '---'}`}
                        </span>
                      </div>

                      <div className="rounded-xl bg-zinc-950/70 p-2.5 border border-zinc-800/60">
                        <span className="text-[10px] text-zinc-500 font-semibold uppercase block">
                          {isB2B ? 'Step 2: Retail Store' : 'Step 2: Drop-off'}
                        </span>
                        <p className="text-zinc-200 font-medium truncate mt-0.5">{ord.customerName}</p>
                        <span className="text-emerald-400 text-[11px] font-medium truncate block">
                          {ord.deliveryAddress}
                        </span>
                      </div>
                    </div>

                    {/* Verification Actions */}
                    <div className="pt-1">
                      {isB2B ? (
                        ord.status !== 'IN_TRANSIT' ? (
                          <button
                            onClick={() => {
                              setSelectedB2BOrder(ord);
                              setIsB2BModalOpen(true);
                            }}
                            className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 py-3 px-4 text-xs font-bold text-white transition flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20"
                          >
                            <span>🏭</span> Verify Loading Bay Pickup (Enter Vendor PIN)
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedB2BOrder(ord);
                              setIsB2BModalOpen(true);
                            }}
                            className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 px-4 text-xs font-bold text-white transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                          >
                            <span>📦</span> Complete Store Handover ({ord.cratesCount || 0} Crates + Store PIN)
                          </button>
                        )
                      ) : (
                        <div className="flex gap-2">
                          <a
                            href={`tel:${ord.customerPhone}`}
                            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 text-center text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition"
                          >
                            📞 Call
                          </a>
                          <button
                            onClick={() => {
                              setSelectedOrder(ord);
                              setIsHandoverOpen(true);
                            }}
                            className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-center text-xs font-semibold text-white shadow-md hover:bg-emerald-500 transition"
                          >
                            Verify Handover PIN
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Completed Dispatches Section */}
        {completedOrders.length > 0 && (
          <div className="pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
              Completed Today ({completedOrders.length})
            </h2>
            <div className="space-y-2">
              {completedOrders.slice(0, 5).map((ord) => (
                <div
                  key={ord.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-900 bg-zinc-900/40 px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-zinc-400 font-medium">#{ord.orderNumber}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                        {ord.orderType || 'B2C'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{ord.customerName}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-medium">Delivered</span>
                    <p className="font-mono text-[10px] text-zinc-400">
                      UGX {Number(ord.totalAmount).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* B2C Handover Modal */}
      <HandoverModal
        isOpen={isHandoverOpen}
        onClose={() => {
          setIsHandoverOpen(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        onDelivered={(ordNum) => {
          setNotification(`Order #${ordNum} delivered successfully!`);
          loadRiderData();
        }}
      />

      {/* B2B Two-Leg Receiving Modal */}
      <B2BHandoverModal
        isOpen={isB2BModalOpen}
        onClose={() => {
          setIsB2BModalOpen(false);
          setSelectedB2BOrder(null);
        }}
        order={selectedB2BOrder}
        riderId={rider?.id || ''}
        onSuccess={(msg) => {
          setNotification(msg);
          loadRiderData();
        }}
      />
    </div>
  );
}
