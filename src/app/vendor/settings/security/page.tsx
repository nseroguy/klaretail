"use client";

import React, { useState } from "react";
import VendorLayout from "@/components/vendor/VendorLayout";
import { KeyRound, CheckCircle2, AlertCircle, Save, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function VendorPasswordChangePage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatusMsg({ text: "New password and confirmation do not match.", type: "error" });
      return;
    }

    if (newPassword.length < 4) {
      setStatusMsg({ text: "Password must be at least 4 characters long.", type: "error" });
      return;
    }

    setIsLoading(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/vendor/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_password",
          currentPassword: currentPassword || undefined,
          newPassword,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to update password.");

      setStatusMsg({ text: "Password changed successfully.", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <VendorLayout>
      <div className="p-6 max-w-xl mx-auto space-y-6 pb-24 font-mono text-xs">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <Link href="/vendor/settings" className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-400" />
              <span>Change Store Password</span>
            </h1>
            <p className="text-[11px] text-slate-400">Update your merchant owner login credentials</p>
          </div>
        </div>

        {statusMsg && (
          <div className={`p-3 rounded-xl border flex items-center gap-2 ${
            statusMsg.type === "success" ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/50" : "bg-rose-950/40 text-rose-300 border-rose-800/50"
          }`}>
            {statusMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-[#121620] border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div>
            <label className="block text-slate-400 mb-1">Current Password</label>
            <input
              type="password"
              placeholder="Enter existing password..."
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="border-t border-slate-800 pt-3">
            <label className="block text-slate-400 mb-1">New Password *</label>
            <input
              type="password"
              required
              placeholder="Minimum 4 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Confirm New Password *</label>
            <input
              type="password"
              required
              placeholder="Re-type new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-950 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isLoading ? "Saving..." : "Update Password"}</span>
            </button>
          </div>
        </form>
      </div>
    </VendorLayout>
  );
}
