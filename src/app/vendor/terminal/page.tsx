"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const STORES = [
  { slug: "bourbon-pizza-wandegeya", name: "Bourbon Pizza Wandegeya" },
  { slug: "ntinda-roastery", name: "Ntinda Fried Chicken & Roastery" },
  { slug: "kiwaatule-grill", name: "Kiwaatule Grill & Local Dishes" },
  { slug: "najjera-fresh", name: "Najjera Fresh Kitchen" },
];

export default function StaffTerminalPage() {
  const router = useRouter();
  const [selectedStore, setSelectedStore] = useState(STORES[0].slug);
  const [staffName, setStaffName] = useState("");
  const [pin, setPin] = useState("");
  const [terminalMode, setTerminalMode] = useState<"pos" | "kitchen">("pos");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/vendor/staff/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorSlug: selectedStore,
          pin: pin || "1234",
          staffName: staffName || (terminalMode === "pos" ? "Cashier" : "Kitchen Line"),
          role: terminalMode,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to authenticate terminal.");
      }

      router.push(data.redirectUrl);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="text-center mb-6">
          <div className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold rounded-full mb-2">
            Store Terminal Switcher
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Operations Login</h1>
          <p className="text-sm text-slate-400 mt-1">Select your store and access your work station</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Select Merchant Store</label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            >
              {STORES.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Terminal Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTerminalMode("pos")}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                  terminalMode === "pos"
                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
                }`}
              >
                POS Register
              </button>
              <button
                type="button"
                onClick={() => setTerminalMode("kitchen")}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border transition ${
                  terminalMode === "kitchen"
                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
                }`}
              >
                Kitchen KDS Screen
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Staff / Operator Name</label>
            <input
              type="text"
              placeholder={terminalMode === "pos" ? "e.g. Sarah K (Cashier)" : "e.g. Chef Ronald"}
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">4-Digit Shift PIN</label>
            <input
              type="password"
              maxLength={6}
              placeholder="Default: 1234"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full tracking-widest text-center text-lg bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-sm transition disabled:opacity-50"
          >
            {loading ? "Authorizing..." : `Launch ${terminalMode === "pos" ? "POS Register" : "KDS Screen"}`}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <a href="/vendor/login" className="text-xs text-slate-400 hover:text-amber-400 transition">
            Store Owner / Admin Management Login &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
