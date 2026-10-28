"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Store, Lock, Phone, ArrowRight, ShieldCheck, Building2, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";

export default function VendorAuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingApprovalMsg, setPendingApprovalMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [loginIdentifier, setLoginIdentifier] = useState("+256772000004");
  const [loginPassword, setLoginPassword] = useState("admin123");

  const [businessName, setBusinessName] = useState("");
  const [signupContact, setSignupContact] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [subCategory, setSubCategory] = useState("restaurant");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/vendor/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "signin",
          phoneNumber: loginIdentifier.startsWith("+") ? loginIdentifier : undefined,
          email: !loginIdentifier.startsWith("+") ? loginIdentifier : undefined,
          password: loginPassword,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Invalid credentials.");

      setSuccessMsg("Welcome back! Loading dashboard...");
      setTimeout(() => router.push("/vendor/dashboard"), 600);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const isEmail = signupContact.includes("@");
      const res = await fetch("/api/vendor/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "signup",
          businessName,
          email: isEmail ? signupContact : undefined,
          phoneNumber: !isEmail ? signupContact : undefined,
          password: signupPassword,
          subCategory,
          sector: "food_beverage",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Registration failed.");

      setSuccessMsg("Store registered! Launching workspace...");
      setTimeout(() => router.push("/vendor/dashboard"), 800);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 font-mono flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center font-black text-emerald-400 text-lg mx-auto">
            KR
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">KlaRetail Merchant Portal</h1>
          <p className="text-xs text-slate-400">Kampala vendor operations & store access</p>
        </div>

        <div className="bg-[#121620] border border-slate-800 p-1 rounded-2xl flex text-xs">
          <button
            onClick={() => { setTab("signin"); setErrorMsg(null); }}
            className={`flex-1 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 ${
              tab === "signin" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sign In</span>
          </button>
          <button
            onClick={() => { setTab("signup"); setErrorMsg(null); }}
            className={`flex-1 py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 ${
              tab === "signup" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            <Store className="w-3.5 h-3.5 text-blue-400" />
            <span>Register Store</span>
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {tab === "signin" ? (
          <form onSubmit={handleSignIn} className="bg-[#121620] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Phone Number or Email</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="+256772000004"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-400">Owner Password</label>
                <Link href="/vendor/settings/security" className="text-[10px] text-emerald-400 hover:underline">
                  Change password
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 text-xs"
            >
              <span>{isLoading ? "Authenticating..." : "Sign In to Terminal"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignUp} className="bg-[#121620] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Store / Business Name *</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Bourbon Pizza Wandegeya"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Classification</label>
              <select
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              >
                <option value="restaurant">Restaurant (Dine-in / Pizza)</option>
                <option value="fast_food">Fast Food (Takeaway)</option>
                <option value="retail">Supermarket / Mart</option>
                <option value="wholesale">Wholesale Depot</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Phone Number or Email (Login ID) *</label>
              <input
                type="text"
                required
                placeholder="+256700000000"
                value={signupContact}
                onChange={(e) => setSignupContact(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Master Password *</label>
              <input
                type="password"
                required
                placeholder="Choose master password..."
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-blue-950 text-xs"
            >
              <span>{isLoading ? "Creating Store..." : "Create Merchant Account"}</span>
              <Sparkles className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Encrypted with SHA-256 and HTTP-only sessions</span>
        </div>
      </div>
    </div>
  );
}
