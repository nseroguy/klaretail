'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CustomerAccountPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [defaultAddress, setDefaultAddress] = useState('');
  const [defaultLandmark, setDefaultLandmark] = useState('');
  const [division, setDivision] = useState('');

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/customer/profile');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setProfile(data.customer);
        setAddresses(data.addresses || []);
        setFullName(data.customer.fullName || '');
        setDefaultAddress(data.customer.defaultAddress || '');
        setDefaultLandmark(data.customer.defaultLandmark || '');
        setDivision(data.customer.division || 'Nakawa');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          defaultAddress,
          defaultLandmark,
          division
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification('Profile & primary delivery location updated.');
        loadProfile();
        setTimeout(() => setNotification(null), 4000);
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
        Loading Account Setup...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-16">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-900/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-white">Account & Setup</h1>
            <p className="text-xs text-zinc-400 font-mono">{profile?.phone}</p>
          </div>
          <Link href="/orders" className="text-xs text-emerald-400 font-semibold hover:underline">
            View Orders →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-4 space-y-4">
        {notification && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-300">
            {notification}
          </div>
        )}

        {/* Lifetime Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <span className="text-[11px] font-semibold uppercase text-zinc-400">Total Orders</span>
            <p className="mt-1 text-2xl font-mono font-bold text-white">{profile?.totalOrders || 0}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <span className="text-[11px] font-semibold uppercase text-zinc-400">Lifetime Spend</span>
            <p className="mt-1 text-xl font-mono font-bold text-emerald-400">
              UGX {Number(profile?.lifetimeSpend || 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Primary Delivery Setup Form */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Delivery Profile & Drop-off Landmark
          </h2>

          <form onSubmit={handleUpdateProfile} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Primary Delivery Address
              </label>
              <input
                type="text"
                value={defaultAddress}
                onChange={(e) => setDefaultAddress(e.target.value)}
                placeholder="e.g. Hajji Kamlat Lane"
                required
                className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Landmark / Building
                </label>
                <input
                  type="text"
                  value={defaultLandmark}
                  onChange={(e) => setDefaultLandmark(e.target.value)}
                  placeholder="e.g. Near Kyaliwajala Stage"
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Division
                </label>
                <select
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Central">Central</option>
                  <option value="Nakawa">Nakawa</option>
                  <option value="Makindye">Makindye</option>
                  <option value="Kawempe">Kawempe</option>
                  <option value="Rubaga">Rubaga</option>
                  <option value="Kira">Kira</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="mt-2 w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : 'Update Account & Address'}
            </button>
          </form>
        </div>

        {/* Saved Address Book */}
        {addresses.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Saved Address Book ({addresses.length})
            </h3>
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs"
              >
                <div>
                  <span className="font-semibold text-white">{addr.label}</span>
                  <p className="text-zinc-400 mt-0.5">{addr.addressLine}</p>
                  {addr.landmark && <p className="text-[11px] text-zinc-500">{addr.landmark}</p>}
                </div>
                {addr.isDefault && (
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400 font-semibold">
                    Default
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
