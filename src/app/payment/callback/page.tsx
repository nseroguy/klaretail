'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderTrackingId = searchParams.get('OrderTrackingId') || searchParams.get('orderTrackingId');
  const merchantReference = searchParams.get('OrderMerchantReference') || searchParams.get('orderMerchantReference');

  const [status, setStatus] = useState<'verifying' | 'paid' | 'failed'>('verifying');
  const [orderData, setOrderData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let attempts = 0;
    const maxAttempts = 15;

    const checkVerification = async () => {
      attempts++;
      try {
        const res = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber: merchantReference,
            trackingId: orderTrackingId,
          }),
        });

        const data = await res.json();

        if (data.success && (data.status === 'paid' || data.status === 'completed')) {
          setStatus('paid');
          setOrderData(data.order);
          clearInterval(interval);
        } else if (attempts >= maxAttempts) {
          setStatus('failed');
          setErrorMessage('Payment verification timed out. If you were debited, check your order status shortly.');
          clearInterval(interval);
        }
      } catch (err: any) {
        if (attempts >= maxAttempts) {
          setStatus('failed');
          setErrorMessage(err.message || 'Verification network failure');
          clearInterval(interval);
        }
      }
    };

    checkVerification();
    interval = setInterval(checkVerification, 2500);

    return () => clearInterval(interval);
  }, [orderTrackingId, merchantReference]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {status === 'verifying' && (
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-16 h-16 rounded-full border-4 border-amber-500 border-t-transparent animate-spin mb-6" />
            <h2 className="text-xl font-bold text-white mb-2">Reconciling Payment</h2>
            <p className="text-sm text-neutral-400 max-w-xs mb-4">
              Verifying transaction confirmation with Pesapal and your telecom network...
            </p>
            <span className="font-mono text-xs text-neutral-500">Ref: {merchantReference}</span>
          </div>
        )}

        {status === 'paid' && (
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-3xl font-bold mb-5 shadow-lg shadow-emerald-950">
              ✓
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-1">Payment Confirmed!</h2>
            <p className="text-xs text-neutral-400 mb-6">Order #{merchantReference} has been settled successfully.</p>

            <div className="w-full bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-4 mb-6 space-y-2.5 text-xs text-left">
              <div className="flex justify-between text-neutral-400">
                <span>Order Reference</span>
                <span className="font-mono text-neutral-200">{merchantReference}</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Tracking Token</span>
                <span className="font-mono text-neutral-200 truncate max-w-[170px]">{orderTrackingId}</span>
              </div>
              <div className="flex justify-between text-neutral-400 pt-2 border-t border-neutral-800">
                <span className="font-semibold text-neutral-200">Amount Paid</span>
                <span className="font-bold font-mono text-emerald-400">
                  UGX {orderData?.totalAmount ? Number(orderData.totalAmount).toLocaleString() : '5,600'}
                </span>
              </div>
            </div>

            <button
              onClick={() => router.push(`/orders/${orderData?.id || merchantReference}`)}
              className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-950 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>Track Live Delivery</span>
              <span>→</span>
            </button>
          </div>
        )}

        {status === 'failed' && (
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 text-2xl font-bold mb-4">
              ✕
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Reconciliation Delayed</h2>
            <p className="text-xs text-neutral-400 mb-6">{errorMessage}</p>
            <div className="flex gap-3 w-full">
              <Link
                href="/"
                className="flex-1 py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-center transition-all active:scale-95"
              >
                Storefront
              </Link>
              <button
                onClick={() => router.push(`/orders/${merchantReference}`)}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
              >
                Check Order
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
