'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RefreshCw, MapPin, Phone } from 'lucide-react';
import OrderTrackingMap from '@/components/orders/OrderTrackingMap';

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async () => {
    if (!orderId) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (data.success) {
        setOrder(data.order);
      }
    } catch (err) {
      console.error('Failed to fetch order status:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
        Locating Order Details...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 text-center text-zinc-300">
        <p className="text-base font-semibold">Order not found</p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
        >
          Return to Store
        </button>
      </div>
    );
  }

  const steps = [
    { key: 'created', label: 'Order Received', desc: 'Order confirmed by vendor' },
    { key: 'rider_assigned', label: 'Courier Dispatched', desc: 'Courier picked up and en route' },
    { key: 'delivered', label: 'Delivered', desc: 'Handover verified via PIN' },
  ];

  const currentStepIdx = order.status === 'delivered' ? 2 : order.status === 'rider_assigned' ? 1 : 0;

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100 pb-12">
      <div className="mx-auto max-w-xl p-4 space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
              Live Order Tracking
            </span>
            <h1 className="text-lg font-black text-white">Order #{order.orderNumber}</h1>
          </div>
          <button
            onClick={fetchStatus}
            disabled={refreshing}
            className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Update</span>
          </button>
        </div>

        {/* Live Interactive Transit Map */}
        <OrderTrackingMap
          status={order.status}
          customerCoords={{ lat: 0.3644, lng: 32.6515, address: order.deliveryAddress }}
          vendorCoords={{ lat: 0.3689, lng: 32.6288, name: order.vendorName }}
          riderCoords={{ lat: 0.3665, lng: 32.6395, name: order.riderName }}
        />

        {/* PIN Banner */}
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Delivery Handover PIN
          </p>
          <p className="my-1 font-mono text-4xl font-black tracking-widest text-white">
            {order.deliveryPin}
          </p>
          <p className="text-[11px] text-zinc-400">
            Give this 4-digit code to your courier upon arrival to confirm delivery.
          </p>
        </div>

        {/* Milestones */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Delivery Status</h2>
          <div className="space-y-4">
            {steps.map((st, i) => {
              const isDone = i <= currentStepIdx;
              const isCurrent = i === currentStepIdx;
              return (
                <div key={st.key} className="flex items-start gap-3">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : 'border border-zinc-700 bg-zinc-950 text-zinc-500'
                    }`}
                  >
                    {isDone ? '✓' : i + 1}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${isCurrent ? 'text-emerald-400' : isDone ? 'text-white' : 'text-zinc-500'}`}>
                      {st.label}
                    </p>
                    <p className="text-xs text-zinc-400">{st.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Courier Details Card */}
        {order.riderName && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Assigned Courier</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-xl text-emerald-400 border border-emerald-500/20">
                  🛵
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{order.riderName}</p>
                  <p className="font-mono text-xs text-zinc-400">Plate: {order.riderPlate || 'Boda Boda'}</p>
                </div>
              </div>
              {order.riderPhone && (
                <a
                  href={`tel:${order.riderPhone}`}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-emerald-500 transition"
                >
                  <Phone className="h-3.5 w-3.5" /> Call Courier
                </a>
              )}
            </div>
          </div>
        )}

        {/* Drop-off & Payment Info */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-2 text-xs">
          <div className="flex items-start gap-2 text-zinc-300">
            <MapPin className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Delivery Drop-Off</p>
              <p className="text-zinc-400">{order.deliveryAddress || 'Kampala Drop-off'}</p>
            </div>
          </div>
          <div className="flex justify-between border-t border-zinc-800/80 pt-2 text-zinc-400">
            <span>Payment Method:</span>
            <span className="font-bold text-white uppercase">{order.paymentMethod}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Total Amount:</span>
            <span className="font-mono font-bold text-emerald-400">UGX {Number(order.totalAmount).toLocaleString()}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
