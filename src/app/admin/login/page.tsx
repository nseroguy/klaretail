'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';

const DEMO_STAFF_ACCOUNTS = [
  { role: 'Super Admin', phone: '+256700000001', tag: 'Full Governance & Metrics' },
  { role: 'Vendor Owner', phone: '+256700000002', tag: 'Business Owner & Products' },
  { role: 'Admin (Dispatch)', phone: '+256700000003', tag: 'Logistics & Rider Allocator' },
];

export default function StaffLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (phoneToSubmit: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneToSubmit }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Login failed.');
      }
      router.push('/admin');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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

        <form onSubmit={(e) => { e.preventDefault(); handleLogin(phone); }} className="bg-[#121614] border border-[#1E2521] p-6 rounded-3xl space-y-4 shadow-xl">
          <div>
            <label className="text-xs font-semibold text-neutral-400 block mb-1.5">Registered Staff Phone</label>
            <input
              type="text"
              required
              placeholder="+256 700 000 001"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full text-sm font-mono p-3.5 rounded-xl bg-[#171D1A] border border-[#242F28] text-white focus:outline-emerald-500 placeholder-neutral-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !phone}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 text-[#0A0D0C] font-black text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Operations Console'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="space-y-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 block text-center">
            One-Touch Quick Login (Staff Tiers):
          </span>
          <div className="grid grid-cols-1 gap-2">
            {DEMO_STAFF_ACCOUNTS.map((acc) => (
              <button
                key={acc.phone}
                onClick={() => { setPhone(acc.phone); handleLogin(acc.phone); }}
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
