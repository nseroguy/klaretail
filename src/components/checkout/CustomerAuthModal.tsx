'use client';

import React, { useState } from 'react';
import { Smartphone, KeyRound, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (customer: { id: string; phone: string; fullName?: string }) => void;
}

export default function CustomerAuthModal({ isOpen, onClose, onAuthenticated }: CustomerAuthModalProps) {
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [phone, setPhone] = useState('0772123456'); // Default sample: Sarah Namukasa
  const [fullName, setFullName] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // STEP 1: Request SMS Verification Code
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/customer-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          fullName: fullName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to dispatch verification code.');
      }

      setStep('OTP');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify Code and Issue Session Cookie
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/customer-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          otp: otp.trim(),
          fullName: fullName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid 6-digit OTP code.');
      }

      onAuthenticated(data.customer || { id: data.customerId, phone });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 font-sans text-zinc-100">
      <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900/95 p-6 shadow-2xl backdrop-blur-md">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Instant Checkout Auth</h2>
              <p className="text-[11px] text-zinc-400">One-step SMS verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Phone + Name Form */}
        {step === 'PHONE' && (
          <form onSubmit={handleRequestOtp} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Your Full Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Sarah Namukasa"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950/60 px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1 flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-emerald-400" /> MTN / Airtel Phone Number
              </label>
              <div className="flex rounded-xl border border-zinc-700 bg-zinc-950/60 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500">
                <span className="flex items-center px-3 text-xs font-mono text-zinc-400 border-r border-zinc-800">
                  +256
                </span>
                <input
                  type="tel"
                  placeholder="772 123 456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full bg-transparent px-3 py-2.5 text-sm font-mono text-white placeholder-zinc-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || phone.length < 9}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950 hover:bg-emerald-500 disabled:opacity-50 transition"
            >
              {loading ? 'Sending Code...' : 'Get Instant Verification Code'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {/* STEP 2: OTP Verification Form */}
        {step === 'OTP' && (
          <form onSubmit={handleVerifyOtp} className="mt-4 space-y-4">
            <div className="rounded-xl bg-zinc-950/80 p-3 text-center text-xs text-zinc-300 border border-zinc-800/80">
              Enter the 6-digit code sent to <span className="font-semibold text-emerald-400 font-mono">{phone}</span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-amber-400 text-center mb-1 flex items-center justify-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> 6-Digit SMS Code
              </label>
              <input
                type="text"
                maxLength={6}
                inputMode="numeric"
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                autoFocus
                className="w-full rounded-xl border border-amber-500/40 bg-zinc-950/60 px-4 py-3 text-center font-mono text-2xl tracking-widest text-amber-300 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950 hover:bg-emerald-500 disabled:opacity-50 transition"
            >
              {loading ? 'Verifying...' : 'Confirm & Proceed to Checkout'}
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('PHONE');
                setOtp('');
              }}
              className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition"
            >
              Change Phone Number
            </button>
          </form>
        )}

        <div className="mt-5 border-t border-zinc-800/80 pt-3 text-center text-[10px] text-zinc-500">
          No password needed • Automatic account creation for new shoppers
        </div>
      </div>
    </div>
  );
}
