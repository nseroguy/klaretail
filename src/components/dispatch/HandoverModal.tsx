'use client';

import React, { useState } from 'react';

interface AssignedOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  totalAmount: number;
  codAmountDue: string | number;
  paymentMethod: string;
  status: string;
}

interface HandoverModalProps {
  order: AssignedOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onDelivered: (orderNumber: string) => void;
}

export default function HandoverModal({ order, isOpen, onClose, onDelivered }: HandoverModalProps) {
  const [pin, setPin] = useState('');
  const [cashCollected, setCashCollected] = useState<string>(
    order ? String(order.codAmountDue || order.totalAmount) : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const isCod = order.paymentMethod === 'CASH_ON_DELIVERY';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/dispatch/verify-handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          deliveryPin: pin.trim(),
          cashCollected: isCod ? Number(cashCollected) : 0,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'PIN verification failed.');
      }

      onDelivered(order.orderNumber);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Confirm Handover
            </h3>
            <p className="text-xs text-zinc-500">Order #{order.orderNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="my-3 rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-3 text-xs space-y-1">
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Customer:</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{order.customerName}</span>
            </div>
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Drop-off:</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">
                {order.deliveryAddress}
              </span>
            </div>
            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Payment Type:</span>
              <span className="font-bold text-emerald-600 uppercase">{order.paymentMethod}</span>
            </div>
          </div>

          {/* Cash Collection Input if COD */}
          {isCod && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Cash to Collect (UGX)
              </label>
              <input
                type="number"
                value={cashCollected}
                onChange={(e) => setCashCollected(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          {/* 4-Digit Handover PIN Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 text-center">
              Enter Customer's 4-Digit PIN
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
              autoFocus
              className="mt-1.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-3 text-center text-2xl font-mono tracking-widest text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || pin.length < 4}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50 transition"
          >
            {isSubmitting ? 'Verifying PIN...' : 'Verify PIN & Complete Delivery'}
          </button>
        </form>
      </div>
    </div>
  );
}
