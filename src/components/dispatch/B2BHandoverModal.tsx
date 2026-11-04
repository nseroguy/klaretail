'use client';

import React, { useState } from 'react';

interface B2BHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  riderId: string;
  onSuccess: (message: string) => void;
}

export default function B2BHandoverModal({
  isOpen,
  onClose,
  order,
  riderId,
  onSuccess,
}: B2BHandoverModalProps) {
  const [pin, setPin] = useState('');
  const [emptyCrates, setEmptyCrates] = useState(order?.cratesCount || 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const isDocksidePickup = order.status !== 'IN_TRANSIT';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = isDocksidePickup
        ? {
            action: 'SUPPLIER_DOCK_PICKUP',
            orderId: order.orderNumber,
            pin: pin.trim(),
            riderId,
          }
        : {
            action: 'RETAIL_STORE_RECEIVING',
            orderId: order.orderNumber,
            pin: pin.trim(),
            emptyCratesReturned: Number(emptyCrates),
          };

      const res = await fetch('/api/b2b/orders/receiving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        onSuccess(data.message);
        onClose();
      } else {
        setError(data.message || 'PIN verification failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl text-white">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              B2B Restock Dispatch
            </span>
            <h3 className="text-lg font-bold mt-1 text-zinc-100">{order.orderNumber}</h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-xl bg-zinc-900/60 p-3.5 border border-zinc-800/80 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-zinc-400">Loading Bay (Supplier):</span>
              <span className="font-medium text-zinc-200">{order.vendorName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Destination (Retail Store):</span>
              <span className="font-medium text-zinc-200">{order.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Total Crates Expected:</span>
              <span className="font-semibold text-amber-400 font-mono">{order.cratesCount || 0} crates</span>
            </div>
          </div>

          {isDocksidePickup ? (
            <div>
              <label className="block text-xs font-medium text-amber-300 mb-1">
                Enter Supplier Dispatch PIN
              </label>
              <p className="text-[11px] text-zinc-400 mb-2">
                Ask the warehouse supervisor at {order.vendorName} for their 4-digit dock release PIN before loading.
              </p>
              <input
                type="text"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Vendor PIN"
                autoFocus
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-2xl font-mono tracking-widest text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-emerald-300 mb-1">
                  Enter Retail Store Delivery PIN
                </label>
                <p className="text-[11px] text-zinc-400 mb-2">
                  Ask {order.customerName} store receiving manager for their secret handover PIN.
                </p>
                <input
                  type="text"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Store PIN"
                  autoFocus
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-2xl font-mono tracking-widest text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Empty Crates Handed Back
                </label>
                <input
                  type="number"
                  min={0}
                  value={emptyCrates}
                  onChange={(e) => setEmptyCrates(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-mono text-white focus:border-emerald-500 focus:outline-none"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Unreturned crates incur automated deposit adjustments on the SNPL ledger.
                </span>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-zinc-800 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !pin.trim()}
              className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white transition disabled:opacity-50 ${
                isDocksidePickup
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {loading ? 'Verifying...' : isDocksidePickup ? 'Confirm Dock Pickup' : 'Complete Delivery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
