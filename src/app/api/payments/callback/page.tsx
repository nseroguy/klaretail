// src/app/payment/callback/page.tsx
'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface VerificationState {
  loading: boolean;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'UNKNOWN';
  orderId?: string;
  orderNumber?: string;
  amount?: number;
  message?: string;
}

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderTrackingId = searchParams.get('OrderTrackingId');
  const orderMerchantReference = searchParams.get('OrderMerchantReference');

  const [state, setState] = useState<VerificationState>({
    loading: true,
    status: 'PENDING',
  });

  useEffect(() => {
    if (!orderTrackingId && !orderMerchantReference) {
      setState({
        loading: false,
        status: 'FAILED',
        message: 'No order or tracking reference provided in callback.',
      });
      return;
    }

    async function pollPaymentStatus() {
      try {
        const response = await fetch(
          `/api/payments/verify?orderTrackingId=${orderTrackingId || ''}&merchantReference=${orderMerchantReference || ''}`
        );
        const data = await response.json();

        if (response.ok && data.success) {
          setState({
            loading: false,
            status: data.status,
            orderId: data.orderId,
            orderNumber: data.orderNumber,
            amount: data.amount,
            message: data.message,
          });
        } else {
          setState({
            loading: false,
            status: 'FAILED',
            message: data.error || 'Failed to verify payment status.',
          });
        }
      } catch (err: any) {
        setState({
          loading: false,
          status: 'FAILED',
          message: err.message || 'Network error verifying transaction.',
        });
      }
    }

    pollPaymentStatus();
  }, [orderTrackingId, orderMerchantReference]);

  if (state.loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <h2 className="text-xl font-bold text-gray-900">Verifying Payment...</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Please wait while we confirm your transaction with Pesapal and lock in your delivery slot.
        </p>
      </div>
    );
  }

  if (state.status === 'COMPLETED') {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-emerald-100 max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
          ✓
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Order Confirmed!</h1>
          <p className="text-sm text-gray-600 mt-1">
            Order <span className="font-semibold text-gray-800">#{state.orderNumber || orderMerchantReference}</span> is placed.
          </p>
        </div>

        {state.amount && (
          <div className="bg-gray-50 p-4 rounded-xl flex justify-between items-center text-sm">
            <span className="text-gray-500">Amount Paid</span>
            <span className="font-bold text-gray-900">UGX {state.amount.toLocaleString()}</span>
          </div>
        )}

        <div className="space-y-2">
          <Link
            href={`/orders/${state.orderId || orderMerchantReference}`}
            className="block w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition"
          >
            Track Order Live
          </Link>
          <Link
            href="/"
            className="block w-full py-2.5 px-4 text-gray-600 hover:text-gray-900 text-sm font-medium transition"
          >
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-rose-100 max-w-md w-full text-center space-y-6">
      <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
        ✕
      </div>
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Payment Incomplete</h1>
        <p className="text-sm text-gray-600 mt-1">
          {state.message || 'We could not confirm your transaction. If money was deducted, it will reconcile automatically.'}
        </p>
      </div>

      <div className="space-y-2">
        <Link
          href="/checkout"
          className="block w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl transition"
        >
          Return to Checkout
        </Link>
        <Link
          href="/"
          className="block w-full py-2.5 px-4 text-gray-600 hover:text-gray-900 text-sm font-medium transition"
        >
          Cancel and Return Home
        </Link>
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        }
      >
        <CallbackContent />
      </Suspense>
    </main>
  );
}