'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  KeyRound, 
  MapPin, 
  Phone, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowLeft, 
  RefreshCw,
  UserCheck,
  Bike
} from 'lucide-react';

export default function OrderTrackingPage() {
  const params = useParams();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Order not found');
      }
      setOrder(data.order);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) fetchOrder();
    const interval = setInterval(() => {
      if (orderId) fetchOrder();
    }, 8000);
    return () => clearInterval(interval);
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0C0F0E] text-white flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-xs font-mono text-neutral-400">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Loading delivery manifest...</span>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#0C0F0E] text-white flex flex-col items-center justify-center p-4">
        <p className="text-sm text-rose-400 mb-4">{error || 'Order not found'}</p>
        <Link href="/" className="px-4 py-2 bg-emerald-600 rounded-xl text-xs font-bold text-white">
          Back to Store
        </Link>
      </div>
    );
  }

  const isDelivered = order.status === 'delivered';
  const hasRider = Boolean(order.rider);

  return (
    <div className="min-h-screen bg-[#0C0F0E] text-[#ECEEEB] py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
            Back to Store
          </Link>
          <span className="text-xs font-mono font-bold text-neutral-400">
            Order #{order.orderNumber}
          </span>
        </div>

        {/* 1. Amber Handshake PIN Card */}
        <div className="bg-[#141916] border border-amber-500/40 rounded-3xl p-6 text-center space-y-4 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600" />
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/70 text-amber-300 border border-amber-700/60 text-xs font-bold">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Delivery Verification PIN</span>
          </div>

          <div>
            <div className="text-5xl font-black font-mono tracking-widest text-white mt-1">
              {order.deliveryPin || '••••'}
            </div>
            <p className="text-xs text-neutral-400 mt-2 max-w-md mx-auto">
              Share this 4-digit code with the courier <strong className="text-white">only after</strong> inspecting your items and handing over cash.
            </p>
          </div>

          <div className="pt-3 border-t border-[#232D27] flex justify-between items-center text-xs">
            <span className="text-neutral-400">Cash Due on Arrival:</span>
            <span className="font-mono font-black text-amber-400 text-base">
              UGX {Number(order.codAmountDue || order.totalAmount).toLocaleString()}
            </span>
          </div>
        </div>

        {/* 2. Manual Dispatch & Courier Assignment Card */}
        <div className="bg-[#121614] border border-[#1E2521] rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Bike className="w-4 h-4 text-emerald-400" />
              Courier & Delivery Assignment
            </span>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
              {order.status.toUpperCase()}
            </span>
          </h3>

          {hasRider ? (
            <div className="p-4 rounded-2xl bg-[#171E1A] border border-[#232D26] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center font-bold">
                  {order.rider.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{order.rider.name}</h4>
                  <p className="text-[11px] text-neutral-400">Assigned Delivery Courier</p>
                  <p className="text-[11px] font-mono text-emerald-400">{order.rider.vehiclePlate}</p>
                </div>
              </div>
              <a
                href={`tel:${order.rider.phone}`}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-[#0C0F0E] text-xs font-bold flex items-center gap-1.5 transition"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Courier</span>
              </a>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-[#151917] border border-[#202723] text-xs text-neutral-400 flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-white">Order Queued in Area Dispatch Manifest</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  A dispatch agent or vendor in your corridor is assigning a designated rider.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 3. Escrow Handshake Protection Guarantee */}
        <div className="p-4 rounded-2xl bg-[#0E1311] border border-[#19221D] flex items-center gap-3 text-xs text-neutral-400">
          <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
          <p>
            <strong>100% Buyer Protection:</strong> Cash is only released when your unique Handshake PIN is validated on the courier device.
          </p>
        </div>

      </div>
    </div>
  );
}
