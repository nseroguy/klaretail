'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, Lock, Phone, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';

export default function RiderLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('+256701987654');
  const [password, setPassword] = useState('KlaStaff@2026!');
  const [otp, setOtp] = useState('');
  const [mfaStep, setMfaStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const formattedPhone = phone.trim().startsWith('+') ? phone.trim() : `+${phone.trim()}`;

    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formattedPhone,
          password: mfaStep ? undefined : password,
          otp: mfaStep ? otp.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Authentication failed. Please verify credentials.');
      }

      if (data.mfaRequired) {
        setMfaStep(true);
        return;
      }

      router.push(data.redirectUrl || '/dispatch');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0C0F0E] text-[#ECEEEB] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-[#1E2722] bg-[#121714] p-8 shadow-2xl space-y-6">
        
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-400">
            <Bike className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">KlaRetail Courier Terminal</h1>
          <p className="text-xs text-neutral-400">Kampala Dispatch & Field Operations</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/40 p-3.5 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {!mfaStep ? (
            <>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Rider Phone Number
                </label>
                <div className="mt-1.5 flex items-center rounded-xl border border-[#232D28] bg-[#0E1210] px-3.5 py-2.5">
                  <Phone className="h-4 w-4 text-neutral-500 mr-2.5 shrink-0" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+256701987654"
                    required
                    className="w-full bg-transparent text-sm text-white placeholder-neutral-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Password
                </label>
                <div className="mt-1.5 flex items-center rounded-xl border border-[#232D28] bg-[#0E1210] px-3.5 py-2.5">
                  <Lock className="h-4 w-4 text-neutral-500 mr-2.5 shrink-0" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full bg-transparent text-sm text-white placeholder-neutral-600 focus:outline-none"
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" /> Enter 6-Digit SMS Code
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
                className="mt-2 w-full rounded-xl border border-emerald-500/40 bg-[#0E1210] px-4 py-3 text-center font-mono text-2xl tracking-widest text-emerald-300 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (mfaStep && otp.length < 6)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 text-xs transition disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : mfaStep ? 'Verify OTP & Enter' : 'Sign In as Courier'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="border-t border-[#1C2520] pt-4 text-center">
          <p className="text-[11px] text-neutral-500">
            Courier: <span className="font-mono text-neutral-300">+256701987654</span> • <span className="font-mono text-neutral-300">KlaStaff@2026!</span>
          </p>
        </div>

      </div>
    </div>
  );
}
