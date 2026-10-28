'use client';

import React, { useState } from 'react';

interface Address {
  id: string;
  label: string;
  addressLine: string;
  landmark?: string;
  isDefault: boolean;
}

interface CustomerProfile {
  id: string;
  phone: string;
  fullName: string;
  email?: string;
}

interface CheckoutAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (customer: CustomerProfile, addresses: Address[]) => void;
}

export default function CheckoutAuthModal({ isOpen, onClose, onAuthenticated }: CheckoutAuthModalProps) {
  const [step, setStep] = useState<'PHONE' | 'OTP' | 'PROFILE'>('PHONE');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isReturningCustomer, setIsReturningCustomer] = useState(false);
  const [fullName, setFullName] = useState('');
  const [initialAddress, setInitialAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [division, setDivision] = useState('Central');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Step 1: Send OTP Challenge
  const handleRequestChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/customer-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send verification code.');
      }

      setIsReturningCustomer(data.isReturningCustomer);
      if (data.customerName) setFullName(data.customerName);
      setStep('OTP');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP (+ optional JIT profile creation)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const payload: any = {
        phone,
        otp,
      };

      if (!isReturningCustomer) {
        payload.fullName = fullName || 'KlaRetail Customer';
        payload.initialAddress = initialAddress;
        payload.landmark = landmark;
        payload.division = division;
      }

      const res = await fetch('/api/auth/customer-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid verification code.');
      }

      onAuthenticated(data.customer, data.addresses || []);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {step === 'PHONE' && 'Quick Checkout'}
              {step === 'OTP' && (isReturningCustomer ? 'Welcome Back!' : 'Create Your Delivery Account')}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {step === 'PHONE' && 'Enter your Ugandan mobile number to continue'}
              {step === 'OTP' && `Enter the 6-digit code sent to ${phone}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="my-3 rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900">
            {errorMsg}
          </div>
        )}

        {/* STEP 1: PHONE CHALLENGE */}
        {step === 'PHONE' && (
          <form onSubmit={handleRequestChallenge} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Phone Number (MTN / Airtel)
              </label>
              <div className="mt-1.5 flex rounded-lg border border-zinc-300 dark:border-zinc-700 focus-within:ring-2 focus-within:ring-emerald-500 overflow-hidden">
                <span className="flex items-center bg-zinc-100 dark:bg-zinc-800 px-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  +256
                </span>
                <input
                  type="tel"
                  placeholder="701 234 567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full bg-transparent px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50 transition"
            >
              {loading ? 'Sending Code...' : 'Continue with Phone'}
            </button>
          </form>
        )}

        {/* STEP 2: VERIFY OTP + JIT DETAILS */}
        {step === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                6-Digit Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-3 text-center text-xl font-mono tracking-widest text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* If first-time buyer, capture drop-off details immediately */}
            {!isReturningCustomer && (
              <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Full Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah Namukasa"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Delivery Address / Street</label>
                  <input
                    type="text"
                    placeholder="e.g. Plot 14 Kyadondo Road, Nakasero"
                    value={initialAddress}
                    onChange={(e) => setInitialAddress(e.target.value)}
                    required
                    className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Nearby Landmark</label>
                    <input
                      type="text"
                      placeholder="e.g. Near Oasis Mall"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Division</label>
                    <select
                      value={division}
                      onChange={(e) => setDivision(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Central">Central (CBD, Nakasero)</option>
                      <option value="Nakawa">Nakawa (Ntinda, Bugolobi)</option>
                      <option value="Makindye">Makindye (Kabalagala)</option>
                      <option value="Rubaga">Rubaga (Mengo)</option>
                      <option value="Kawempe">Kawempe (Kalerwe)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50 transition"
            >
              {loading ? 'Verifying...' : isReturningCustomer ? 'Confirm & Continue Checkout' : 'Create Profile & Place Order'}
            </button>

            <button
              type="button"
              onClick={() => setStep('PHONE')}
              className="w-full text-center text-xs text-zinc-400 hover:text-zinc-600 transition"
            >
              Change phone number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
