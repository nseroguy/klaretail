'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, AlertCircle, KeyRound, Smartphone, Lock } from 'lucide-react';

const DEMO_STAFF_ACCOUNTS = [
  { role: 'Super Admin', phone: '+256700000001', pass: 'KlaStaff@2026!', tag: 'Full Governance & Metrics' },
  { role: 'Vendor Owner', phone: '+256700000002', pass: 'KlaStaff@2026!', tag: 'Business Owner & Products' },
  { role: 'Admin (Dispatch)', phone: '+256700000003', pass: 'KlaStaff@2026!', tag: 'Logistics & Rider Allocator' },
  { role: 'Courier (Brian)', phone: '+256701987654', pass: 'KlaStaff@2026!', tag: 'Rider Terminal' }
];

export default function StaffLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('+256700000001');
  const [password, setPassword] = useState('KlaStaff@2026!');
  const [otp, setOtp] = useState('');
  const [mfaStep, setMfaStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (phoneVal = phone, passVal = password, otpVal = otp) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneVal,
          password: passVal,
          otp: mfaStep ? otpVal : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Login failed.');
      }

      if (data.mfaRequired) {
        setMfaStep(true);
        return;
      }

      router.push(data.redirectUrl || '/admin');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (accPhone: string, accPass: string) => {
    setPhone(accPhone);
    setPassword(accPass);
    setMfaStep(false);
    handleLogin(accPhone, accPass, '');
  };

  return (
    <div className="min-h-screen bg-[#0A0D0C] text-[#ECEEEB] flex flex-col justify-center items-center px-4 font-sans">
      <div className="max-w-md w-full space-y-6">
        
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-400 mb-1">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">KlaRetail Staff Portal</h1>
          <p className="text-xs text-neutral-400">
            Internal console for Business Owners, Logistics Dispatchers & Platform Admins
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-950/70 border border-rose-800 text-rose-300 rounded-2xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form 
          onSubmit={(e) => { e.preventDefault(); handleLogin(); }} 
          className="bg-[#121614] border border-[#1E2521] p-6 rounded-3xl space-y-4 shadow-xl"
        >
          {!mfaStep ? (
            <>
              <div>
                <label className="text-xs font-semibold text-neutral-400 block mb-1.5 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" /> Registered Staff Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+256700000001"
                  className="w-full bg-[#0E1210] border border-[#232B25] rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-400 block mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" /> Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#0E1210] border border-[#232B25] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </>
          ) : (
            <div>
              <label className="text-xs font-semibold text-neutral-400 block mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" /> Enter 6-Digit Verification OTP
              </label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="w-full bg-[#0E1210] border border-amber-600/40 rounded-xl px-3.5 py-3 text-center text-lg tracking-widest font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                autoFocus
                required
              />
              <p className="text-[10px] text-neutral-500 mt-2 text-center">
                OTP sent via secure internal backbone to {phone}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? 'Authenticating...' : mfaStep ? 'Verify OTP & Enter' : 'Sign In to Operations Console'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="space-y-2 pt-2">
          <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block">
            One-Touch Quick Login (Staff Tiers):
          </span>
          <div className="grid grid-cols-1 gap-2">
            {DEMO_STAFF_ACCOUNTS.map((acc) => (
              <button
                key={acc.phone}
                onClick={() => handleQuickFill(acc.phone, acc.pass)}
                className="p-3.5 rounded-2xl bg-[#131815] border border-[#202923] hover:border-emerald-600/60 text-left transition flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-bold text-xs text-white">{acc.role}</div>
                  <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{acc.phone}</div>
                </div>
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-lg">
                  {acc.tag}
                </span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
