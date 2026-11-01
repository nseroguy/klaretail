'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Bike, 
  MapPin, 
  KeyRound, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Search, 
  Filter, 
  ShieldAlert, 
  Check, 
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  PackageCheck,
  LogOut
} from 'lucide-react';

interface OrderItem {
  orderType?: 'B2C' | 'B2B';
  wholesalerName?: string | null;
  retailerName?: string | null;
  id: string;
  orderNumber: string;
  status: string;
  mode: string;
  paymentMethod: string;
  productSubtotal: number;
  deliveryFee: number;
  totalAmount: number;
  deliveryPin: string;
  codAmountDue: number;
  codCashReceived: number;
  codVerifiedAt: string | null;
  assignedRiderId: string | null;
  riderName: string | null;
  riderVehiclePlate: string | null;
  riderPhone: string | null;
  customerId: string;
  createdAt: string;
}

interface RiderItem {
  id: string;
  name: string;
  phone: string;
  vehiclePlate: string;
}

export default function AdminPortalPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [riders, setRiders] = useState<RiderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRiderMap, setSelectedRiderMap] = useState<{ [orderId: string]: string }>({});
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);
  const [inputPin, setInputPin] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [alertBanner, setAlertBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/admin/orders');
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
        setRiders(data.riders || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/staff-logout', { method: 'POST' });
      router.push('/admin/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  const stats = useMemo(() => {
    const isPending = (status: string, riderId?: string) =>
      !riderId && ['created', 'SUBMITTED', 'ACCEPTED'].includes(status);
    const isInTransit = (status: string, riderId?: string) =>
      riderId || ['rider_assigned', 'IN_TRANSIT', 'in_transit'].includes(status);
    const isCompleted = (status: string) =>
      ['delivered', 'DELIVERED_AND_RECEIVED'].includes(status);

    const pendingDispatch = orders.filter((o) => isPending(o.status, o.assignedRiderId)).length;
    const inTransit = orders.filter((o) => isInTransit(o.status, o.assignedRiderId) && !isCompleted(o.status)).length;
    const deliveredCount = orders.filter((o) => isCompleted(o.status)).length;
    const totalCash = orders
      .filter((o) => isCompleted(o.status))
      .reduce((sum, o) => sum + (Number(o.codCashReceived) || Number(o.totalAmount)), 0);

    return { pendingDispatch, inTransit, deliveredCount, totalCash };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const isCompleted = ['delivered', 'DELIVERED_AND_RECEIVED'].includes(o.status);
      const isTransit = (o.assignedRiderId || ['rider_assigned', 'IN_TRANSIT', 'in_transit'].includes(o.status)) && !isCompleted;
      const isPending = !o.assignedRiderId && ['created', 'SUBMITTED', 'ACCEPTED'].includes(o.status);

      if (statusFilter === 'all') return true;
      if (statusFilter === 'pending') return isPending;
      if (statusFilter === 'transit') return isTransit;
      if (statusFilter === 'delivered') return isCompleted;
      return true;
    });
  }, [orders, statusFilter]);

  const handleAssignRider = async (orderId: string) => {
    const riderId = selectedRiderMap[orderId] || riders[0]?.id;
    if (!riderId) {
      alert('No rider selected');
      return;
    }

    setSubmittingAction(true);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          action: 'assign_rider',
          riderId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAlertBanner({ type: 'success', message: 'Courier assigned successfully.' });
        fetchDashboardData();
      } else {
        setAlertBanner({ type: 'error', message: data.message || 'Assignment failed.' });
      }
    } catch (err: any) {
      setAlertBanner({ type: 'error', message: err.message });
    } finally {
      setSubmittingAction(false);
      setTimeout(() => setAlertBanner(null), 4000);
    }
  };

  const handleVerifyPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingOrderId || !inputPin) return;

    setSubmittingAction(true);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: verifyingOrderId,
          action: 'verify_pin',
          pin: inputPin,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAlertBanner({ type: 'success', message: 'Handshake PIN verified. Cash reconciled to delivered.' });
        setVerifyingOrderId(null);
        setInputPin('');
        fetchDashboardData();
      } else {
        alert(data.message || 'Incorrect PIN');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingAction(false);
      setTimeout(() => setAlertBanner(null), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0D0C] text-[#ECEEEB] font-sans">
      
      {/* Top Admin Bar with Logout */}
      <header className="border-b border-[#1A221E] bg-[#0E1310]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <div>
              <h1 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                KlaRetail Operations Hub
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300">
                  ADMIN CONSOLE
                </span>
              </h1>
              <p className="text-[11px] text-neutral-400">Kampala Central & Suburban Distribution Operations</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchDashboardData}
              title="Refresh Manifest"
              className="p-2 rounded-xl bg-[#141A17] hover:bg-[#1B231F] border border-[#232C27] text-neutral-400 hover:text-white transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white transition"
            >
              Storefront →
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 hover:text-rose-100 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{loggingOut ? 'Signing out...' : 'Logout'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        
        {alertBanner && (
          <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
            alertBanner.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/80 border-rose-800 text-rose-300'
          }`}>
            <CheckCircle2 className="w-4 h-4" />
            <span>{alertBanner.message}</span>
          </div>
        )}

        {/* 1. Metric Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#121614] border border-[#1E2521] p-5 rounded-2xl space-y-2">
            <span className="text-xs text-neutral-400 font-medium">Pending Dispatch</span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black font-mono text-amber-400">{stats.pendingDispatch}</span>
              <span className="text-[11px] font-bold text-amber-500 bg-amber-950/50 px-2 py-0.5 rounded-md">
                Awaiting Rider
              </span>
            </div>
          </div>

          <div className="bg-[#121614] border border-[#1E2521] p-5 rounded-2xl space-y-2">
            <span className="text-xs text-neutral-400 font-medium">In Transit</span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black font-mono text-cyan-400">{stats.inTransit}</span>
              <span className="text-[11px] font-bold text-cyan-500 bg-cyan-950/50 px-2 py-0.5 rounded-md">
                On the Road
              </span>
            </div>
          </div>

          <div className="bg-[#121614] border border-[#1E2521] p-5 rounded-2xl space-y-2">
            <span className="text-xs text-neutral-400 font-medium">Delivered & Verified</span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black font-mono text-emerald-400">{stats.deliveredCount}</span>
              <span className="text-[11px] font-bold text-emerald-500 bg-emerald-950/50 px-2 py-0.5 rounded-md">
                Handshake Closed
              </span>
            </div>
          </div>

          <div className="bg-[#121614] border border-[#1E2521] p-5 rounded-2xl space-y-2">
            <span className="text-xs text-neutral-400 font-medium">Total Cash Settled (COD)</span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-white">
                UGX {stats.totalCash.toLocaleString()}
              </span>
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-md">
                100% Escrow
              </span>
            </div>
          </div>
        </div>

        {/* 2. Filter Navigation */}
        <div className="flex items-center justify-between border-b border-[#1A221E] pb-3">
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'All Orders' },
              { id: 'pending', label: 'Awaiting Dispatch' },
              { id: 'transit', label: 'Active Delivery' },
              { id: 'delivered', label: 'Delivered' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-emerald-500 text-neutral-950'
                    : 'bg-[#141A17] text-neutral-400 hover:text-white border border-[#212A25]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-neutral-500 font-mono">
            {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} shown
          </span>
        </div>

        {/* 3. Orders Master Table */}
        <div className="bg-[#121614] border border-[#1E2521] rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#171D1A] border-b border-[#212A25] text-neutral-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Order Ref</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Handshake PIN</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assigned Courier</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B231F]">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-500 font-mono">
                      No matching orders found in this queue.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord) => {
                    const assignedRider = riders.find((r) => r.id === ord.assignedRiderId);
                    const isDelivered = ['delivered', 'DELIVERED_AND_RECEIVED'].includes(ord.status);
                    const isB2B = ord.orderType === 'B2B' || ord.orderNumber?.startsWith('PO-');

                    return (
                      <tr key={ord.id} className="hover:bg-[#161B18] transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-emerald-400">{ord.orderNumber}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              isB2B 
                                ? 'bg-purple-950 text-purple-300 border border-purple-800/80' 
                                : 'bg-blue-950 text-blue-300 border border-blue-800/80'
                            }`}>
                              {isB2B ? 'B2B CRATES' : 'B2C RETAIL'}
                            </span>
                          </div>
                          {isB2B && (ord.wholesalerName || ord.retailerName) ? (
                            <span className="block text-[10px] text-neutral-400 font-sans truncate max-w-[200px]" title={`${ord.wholesalerName} → ${ord.retailerName}`}>
                              {ord.wholesalerName || 'Supplier'} → {ord.retailerName || 'Retailer'}
                            </span>
                          ) : null}
                          <span className="block text-[10px] text-neutral-500 font-normal">
                            {new Date(ord.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            ord.paymentMethod === 'cod'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800/80'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-800/80'
                          }`}>
                            {ord.paymentMethod}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          UGX {Number(ord.totalAmount).toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          {isDelivered ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              VERIFIED
                            </span>
                          ) : (
                            <span className="text-amber-400 font-extrabold tracking-wider bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/50">
                              {ord.deliveryPin || '----'}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            ord.status === 'delivered'
                              ? 'bg-emerald-900/60 text-emerald-300'
                              : ord.status === 'rider_assigned' || ord.status === 'accepted'
                              ? 'bg-cyan-900/60 text-cyan-300'
                              : 'bg-neutral-800 text-neutral-300'
                          }`}>
                            {ord.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {isDelivered ? (
                            <span className="text-neutral-400">{ord.riderName || assignedRider?.name || 'Completed'}</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <select
                                value={selectedRiderMap[ord.id] || (ord.assignedRiderId || riders[0]?.id || '')}
                                onChange={(e) =>
                                  setSelectedRiderMap({ ...selectedRiderMap, [ord.id]: e.target.value })
                                }
                                className="bg-[#181F1B] border border-[#26312B] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                              >
                                {riders.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name} ({r.vehiclePlate})
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleAssignRider(ord.id)}
                                disabled={submittingAction}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-neutral-950 font-bold text-[11px] transition cursor-pointer"
                              >
                                Assign
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {!isDelivered ? (
                            <button
                              onClick={() => {
                                setVerifyingOrderId(ord.id);
                                setInputPin('');
                              }}
                              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black rounded-lg text-xs transition cursor-pointer shadow-sm"
                            >
                              Verify PIN
                            </button>
                          ) : (
                            <span className="text-[11px] font-mono text-neutral-500">
                              Cash Settled
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* Handshake Verification Modal */}
      {verifyingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#131815] border border-[#26322B] rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#212A24] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                Reconcile Handshake PIN
              </h3>
              <button
                onClick={() => setVerifyingOrderId(null)}
                className="text-neutral-500 hover:text-white text-xs font-mono"
              >
                ESC
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Enter the 4-digit code provided by the customer upon physical inspection to release the delivery escrow.
            </p>

            <form onSubmit={handleVerifyPinSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={4}
                  required
                  placeholder="e.g. 7419"
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value)}
                  className="w-full text-center text-3xl font-mono tracking-widest font-black py-3 bg-[#1A221E] border border-[#2A372F] rounded-2xl text-white focus:outline-emerald-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVerifyingOrderId(null)}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-700 text-neutral-400 hover:text-white text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAction || inputPin.length < 4}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-800 text-neutral-950 text-xs font-black transition cursor-pointer"
                >
                  {submittingAction ? 'Verifying...' : 'Confirm & Settle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
