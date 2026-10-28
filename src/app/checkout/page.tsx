'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CheckoutAuthModal from '@/components/auth/CheckoutAuthModal';
import { Banknote, Smartphone, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH_ON_DELIVERY' | 'MTN_MOMO' | 'AIRTEL_MONEY'>('CASH_ON_DELIVERY');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/customer/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.customer) {
            setCustomer(data.customer);
            setAddresses(data.addresses || []);
            const defaultAddr = data.addresses?.find((a: any) => a.isDefault);
            if (defaultAddr) setSelectedAddressId(defaultAddr.id);
            else if (data.addresses?.length > 0) setSelectedAddressId(data.addresses[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to pre-hydrate customer session:', err);
      }
    }
    loadProfile();
  }, []);

  const handleAuthSuccess = (authenticatedCustomer: any, customerAddresses: any[]) => {
    setCustomer(authenticatedCustomer);
    setAddresses(customerAddresses);
    const defaultAddr = customerAddresses.find((a: any) => a.isDefault);
    if (defaultAddr) {
      setSelectedAddressId(defaultAddr.id);
    } else if (customerAddresses.length > 0) {
      setSelectedAddressId(customerAddresses[0].id);
    }
  };

  const handlePlaceOrderClick = () => {
    if (!customer) {
      setIsAuthModalOpen(true);
      return;
    }
    submitFinalOrder();
  };

  const submitFinalOrder = async () => {
    setIsPlacingOrder(true);
    setOrderError(null);
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryAddressId: selectedAddressId,
          paymentMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Order failed.');

      // Route customer straight to real-time tracking page
      router.push(`/orders/${data.orderId}`);
    } catch (err: any) {
      setOrderError(err.message);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6 font-sans text-zinc-900 dark:text-zinc-100">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Checkout</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Identity, Delivery & Payment */}
        <div className="md:col-span-2 space-y-6">
          
          {/* 1. Identity */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-3">
              1. Customer Identity
            </h2>
            {customer ? (
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-white">{customer.fullName}</p>
                  <p className="text-xs text-zinc-500">{customer.phone} • {customer.email || 'No email added'}</p>
                </div>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Switch Account
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-sm">
                <p className="text-xs text-zinc-500">Checking out as guest. SMS OTP confirmation required.</p>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  Log In
                </button>
              </div>
            )}
          </div>

          {/* 2. Drop-off Location */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-3">
              2. Delivery Drop-Off
            </h2>
            {addresses.length > 0 ? (
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                      selectedAddressId === addr.id
                        ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : 'border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliveryAddress"
                      checked={selectedAddressId === addr.id}
                      onChange={() => setSelectedAddressId(addr.id)}
                      className="mt-1 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase text-zinc-800 dark:text-zinc-200">
                          {addr.label}
                        </span>
                        {addr.isDefault && (
                          <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">{addr.addressLine}</p>
                      {addr.landmark && <p className="text-xs text-zinc-500">Near: {addr.landmark}</p>}
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                {customer ? 'No saved addresses found. Add an address to proceed.' : 'Log in to select your saved delivery address.'}
              </p>
            )}
          </div>

          {/* 3. Payment Method Picker */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-3">
              3. Payment Method
            </h2>
            <div className="space-y-2.5">
              
              {/* Cash On Delivery */}
              <label
                className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition ${
                  paymentMethod === 'CASH_ON_DELIVERY'
                    ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CASH_ON_DELIVERY"
                    checked={paymentMethod === 'CASH_ON_DELIVERY'}
                    onChange={() => setPaymentMethod('CASH_ON_DELIVERY')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <Banknote className="h-4 w-4 text-emerald-500" /> Cash on Delivery (COD)
                    </p>
                    <p className="text-xs text-zinc-500">Pay physical cash to the courier upon delivery</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-zinc-500">UGX Cash</span>
              </label>

              {/* MTN MoMo */}
              <label
                className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition ${
                  paymentMethod === 'MTN_MOMO'
                    ? 'border-yellow-500 bg-yellow-50/30 dark:bg-yellow-950/20'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="MTN_MOMO"
                    checked={paymentMethod === 'MTN_MOMO'}
                    onChange={() => setPaymentMethod('MTN_MOMO')}
                    className="text-yellow-500 focus:ring-yellow-500"
                  />
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4 text-yellow-500" /> MTN Mobile Money
                    </p>
                    <p className="text-xs text-zinc-500">Instant USSD prompt sent to your MTN phone</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">MoMo Pay</span>
              </label>

              {/* Airtel Money */}
              <label
                className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition ${
                  paymentMethod === 'AIRTEL_MONEY'
                    ? 'border-red-500 bg-red-50/30 dark:bg-red-950/20'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="AIRTEL_MONEY"
                    checked={paymentMethod === 'AIRTEL_MONEY'}
                    onChange={() => setPaymentMethod('AIRTEL_MONEY')}
                    className="text-red-500 focus:ring-red-500"
                  />
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4 text-red-500" /> Airtel Money
                    </p>
                    <p className="text-xs text-zinc-500">Push PIN approval to your Airtel number</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">Airtel Pay</span>
              </label>

            </div>
          </div>
        </div>

        {/* Right Column: Order Breakdown & Submission */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900 shadow-sm h-fit space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Order Summary</h2>
          <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex justify-between"><span>Items Subtotal</span><span className="font-mono">UGX 45,000</span></div>
            <div className="flex justify-between"><span>Delivery Fee (Kampala)</span><span className="font-mono">UGX 5,000</span></div>
          </div>
          <div className="flex justify-between font-bold text-base">
            <span>Total Amount</span><span className="font-mono text-emerald-600 dark:text-emerald-400">UGX 50,000</span>
          </div>

          {orderError && (
            <div className="rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-600 dark:text-red-400">
              {orderError}
            </div>
          )}

          <button
            onClick={handlePlaceOrderClick}
            disabled={isPlacingOrder}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950 hover:bg-emerald-500 disabled:opacity-50 transition"
          >
            {isPlacingOrder ? 'Confirming Order...' : customer ? `Place Order • ${paymentMethod === 'CASH_ON_DELIVERY' ? 'Pay Cash' : 'Pay Mobile Money'}` : 'Continue to Checkout'}
          </button>
        </div>
      </div>

      <CheckoutAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthenticated={handleAuthSuccess}
      />
    </div>
  );
}
