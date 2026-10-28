'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import HandoverModal from '@/components/dispatch/HandoverModal';

interface RiderProfile {
  id: string;
  name: string;
  phone: string;
  vehiclePlate: string;
  walletBalance: string | number;
  maxCashLimit: string | number;
  isActive: boolean;
  isAvailable: boolean;
}

interface AssignedOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  vendorName: string;
  pickupCode: string;
  totalAmount: number;
  codAmountDue: string | number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

export default function RiderDashboardPage() {
  const router = useRouter();
  const [rider, setRider] = useState<RiderProfile | null>(null);
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingShift, setTogglingShift] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AssignedOrder | null>(null);
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);
  const [isRemitOpen, setIsRemitOpen] = useState(false);
  const [remitAmount, setRemitAmount] = useState('');
  const [remitSubmitting, setRemitSubmitting] = useState(false);
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
  }, []);

  const handleToggleShift = async () => {
    if (!rider || togglingShift) return;
    setTogglingShift(true);
    try {
      const target = !rider.isAvailable;
      const res = await fetch('/api/dispatch/toggle-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: target }),
      });
      const data = await res.json();
      if (data.success) {
        setRider({ ...rider, isAvailable: data.isAvailable });
        setNotification(`Shift updated: You are now ${data.isAvailable ? 'AVAILABLE for jobs' : 'OFFLINE'}.`);
        setTimeout(() => setNotification(null), 4000);
      }
    } catch (err) {
      console.error('Failed to toggle shift:', err);
    } finally {
      setTogglingShift(false);
    }
  };

  const handleRemitCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remitAmount || Number(remitAmount) <= 0) return;
    setRemitSubmitting(true);
    try {
      const res = await fetch('/api/dispatch/remit-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(remitAmount) }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification(`Remittance successful: UGX ${Number(remitAmount).toLocaleString()} submitted.`);
        setIsRemitOpen(false);
        setRemitAmount('');
        loadRiderData();
        setTimeout(() => setNotification(null), 5000);
      } else {
        alert(data.message || 'Remittance failed.');
      }
    } catch (err) {
      console.error('Remittance failed:', err);
    } finally {
      setRemitSubmitting(false);
    }
  };

  const handleHandoverSuccess = (orderNumber: string) => {
    setNotification(`Order #${orderNumber} marked delivered and cash settled.`);
    loadRiderData();
    setTimeout(() => setNotification(null), 5000);
  };

  const handleLogout = async () => {
    document.cookie = 'staff_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/dispatch/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
        Loading Courier Console...
      </div>
    );
  }

  const activeOrders = orders.filter((o) => o.status !== 'delivered');
  const deliveredOrders = orders.filter((o) => o.status === 'delivered');
  const balance = Number(rider?.walletBalance || 0);
  const limit = Number(rider?.maxCashLimit || 500000);
  const cashCapacityPercent = Math.min(Math.round((balance / limit) * 100), 100);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-16">
      {/* Sticky Mobile Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-900/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-xl font-bold text-emerald-400 border border-emerald-500/20">
              🛵
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">{rider?.name || 'Courier'}</h1>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="font-mono text-zinc-300">{rider?.vehiclePlate || 'Boda'}</span>
                <span>•</span>
                <span className={rider?.isAvailable ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
                  {rider?.isAvailable ? '● On Duty' : '○ Offline'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleShift}
              disabled={togglingShift}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                rider?.isAvailable
                  ? 'border border-amber-500/30 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50'
                  : 'border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50'
              }`}
            >
              {togglingShift ? '...' : rider?.isAvailable ? 'Go Offline' : 'Go Online'}
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4 space-y-4">
        {/* Banner Notification */}
        {notification && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-300 flex items-center justify-between">
            <span>{notification}</span>
            <button onClick={() => setNotification(null)} className="text-zinc-500 hover:text-white">✕</button>
          </div>
        )}

        {/* Courier Cash & Metrics Card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">COD Cash On Hand</p>
              <p className="mt-1 text-2xl font-mono font-bold text-emerald-400">
                UGX {balance.toLocaleString()}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Max Threshold: UGX {limit.toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => setIsRemitOpen(true)}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
            >
              Remit Cash
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>Holding Capacity</span>
              <span>{cashCapacityPercent}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div 
                className={`h-full transition-all ${cashCapacityPercent > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                style={{ width: `${cashCapacityPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Active Runs Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Active Deliveries ({activeOrders.length})
            </h2>
            <span className="text-[11px] text-zinc-500">
              {deliveredOrders.length} completed shift
            </span>
          </div>

          {activeOrders.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-xs text-zinc-500 space-y-1">
              <p className="text-base">🛵</p>
              <p className="font-semibold text-zinc-400">All clear! No active runs.</p>
              <p className="text-[11px]">Keep your shift online to receive new dispatch alerts.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-lg space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400">
                        #{ord.orderNumber}
                      </span>
                      <p className="mt-1 text-xs text-zinc-400">
                        From: <span className="text-white font-medium">{ord.vendorName}</span>
                      </p>
                      <h3 className="text-sm font-semibold text-white">To: {ord.customerName}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-mono font-bold text-zinc-100">
                        UGX {Number(ord.codAmountDue || ord.totalAmount).toLocaleString()}
                      </span>
                      <p className="text-[10px] uppercase font-semibold text-emerald-400">
                        {ord.paymentMethod === 'CASH_ON_DELIVERY' ? 'Collect COD' : 'Prepaid'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-zinc-950/60 p-2.5">
                      <span className="text-[10px] text-zinc-500 font-semibold uppercase block">Step 1: Pickup</span>
                      <p className="text-zinc-300 font-medium truncate">{ord.vendorName}</p>
                      <span className="font-mono text-zinc-400 text-[11px]">Code: {ord.pickupCode || '---'}</span>
                    </div>

                    <div className="rounded-lg bg-zinc-950/60 p-2.5">
                      <span className="text-[10px] text-zinc-500 font-semibold uppercase block">Step 2: Drop-off</span>
                      <p className="text-zinc-300 font-medium truncate">{ord.deliveryAddress}</p>
                      <span className="text-emerald-400 text-[11px] font-medium">Verify Customer PIN</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <a
                      href={`tel:${ord.customerPhone}`}
                      className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/80 py-2.5 text-center text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition"
                    >
                      📞 Call Customer
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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Completed Runs Section */}
        {deliveredOrders.length > 0 && (
          <div className="pt-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
              Completed Today ({deliveredOrders.length})
            </h2>
            <div className="space-y-2">
              {deliveredOrders.slice(0, 5).map((ord) => (
                <div
                  key={ord.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-900 bg-zinc-900/40 px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <span className="font-mono text-zinc-400 font-medium">#{ord.orderNumber}</span>
                    <p className="text-[11px] text-zinc-500">{ord.customerName}</p>
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

      {/* Cash Remittance Modal */}
      {isRemitOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 text-white space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Remit Collected Cash</h3>
              <button onClick={() => setIsRemitOpen(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <p className="text-xs text-zinc-400">
              Submit COD cash to clear your wallet balance of <strong className="text-emerald-400">UGX {balance.toLocaleString()}</strong>.
            </p>
            <form onSubmit={handleRemitCash} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Amount to Remit (UGX)
                </label>
                <input
                  type="number"
                  max={balance}
                  value={remitAmount}
                  onChange={(e) => setRemitAmount(e.target.value)}
                  placeholder={`Max: ${balance}`}
                  required
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={remitSubmitting || !remitAmount || Number(remitAmount) <= 0}
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50 transition"
              >
                {remitSubmitting ? 'Recording Remittance...' : 'Submit Remittance'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PIN Handover Modal */}
      <HandoverModal
        order={selectedOrder}
        isOpen={isHandoverOpen}
        onClose={() => {
          setIsHandoverOpen(false);
          setSelectedOrder(null);
        }}
        onDelivered={handleHandoverSuccess}
      />
    </div>
  );
}
