'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Bike, CheckCircle2, UserCheck, RefreshCw, KeyRound } from 'lucide-react';

interface OrderItem {
  id: string;
  orderNumber: string;
  totalAmount: number;
  deliveryPin: string;
  status: string;
  paymentMethod: string;
  customerId: string;
  riderId: string | null;
  createdAt: string;
}

const AVAILABLE_RIDERS = [
  { id: '00000000-0000-0000-0000-000000000003', name: 'Joseph Kato', phone: '+256701234567', plate: 'UFE 102A' },
  { id: '00000000-0000-0000-0000-000000000004', name: 'Brian Mukasa', phone: '+256782345678', plate: 'UEX 891B' },
  { id: '00000000-0000-0000-0000-000000000005', name: 'Ronald Ochieng', phone: '+256753456789', plate: 'UFD 452C' },
];

export default function DispatchManagementPage() {
  const [ordersList, setOrdersList] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRider, setSelectedRider] = useState<{ [orderId: string]: string }>({});
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/dispatch/orders');
      const data = await res.json();
      if (data.success) {
        setOrdersList(data.orders);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAssignRider = async (orderId: string) => {
    const riderId = selectedRider[orderId] || AVAILABLE_RIDERS[0].id;
    try {
      const res = await fetch('/api/dispatch/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, riderId }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Order assigned successfully to courier.`);
        fetchOrders();
      } else {
        alert(data.message || 'Failed to assign courier');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0F0E] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div>
            <h1 className="text-xl font-black tracking-tight">KlaRetail Dispatch Console</h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Area & Corridor Manual Order Allocation · Kampala Hub
            </p>
          </div>
          <button
            onClick={fetchOrders}
            className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Manifest</span>
          </button>
        </div>

        {actionMessage && (
          <div className="p-3 bg-emerald-950 border border-emerald-800 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Orders grouped by Status & Area */}
        <div className="grid grid-cols-1 gap-4">
          {ordersList.length === 0 ? (
            <div className="p-12 text-center bg-[#121614] border border-[#1E2521] rounded-3xl">
              <p className="text-xs text-neutral-400">No pending orders awaiting dispatch in the queue.</p>
            </div>
          ) : (
            ordersList.map((ord) => (
              <div
                key={ord.id}
                className="bg-[#121614] border border-[#1E2521] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-white">#{ord.orderNumber}</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-amber-950 text-amber-400 border border-amber-800">
                      {ord.paymentMethod.toUpperCase()}
                    </span>
                    <span className="text-xs text-neutral-400 font-mono">
                      UGX {Number(ord.totalAmount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-400">
                    <span className="flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      PIN: <strong className="text-white font-mono">{ord.deliveryPin}</strong>
                    </span>
                    <span>·</span>
                    <span>Status: <strong className="text-emerald-400">{ord.status}</strong></span>
                  </div>
                </div>

                {/* Rider Assignment Controls */}
                <div className="flex items-center gap-3">
                  <select
                    value={selectedRider[ord.id] || (ord.riderId || AVAILABLE_RIDERS[0].id)}
                    onChange={(e) => setSelectedRider({ ...selectedRider, [ord.id]: e.target.value })}
                    className="bg-[#171E1A] border border-[#232D26] text-xs text-white rounded-xl px-3 py-2 focus:outline-none"
                  >
                    {AVAILABLE_RIDERS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.plate})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleAssignRider(ord.id)}
                    className="px-4 py-2 bg-[#00D084] hover:bg-[#00BA76] text-[#0C0F0E] text-xs font-black rounded-xl transition cursor-pointer"
                  >
                    Assign Rider
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
