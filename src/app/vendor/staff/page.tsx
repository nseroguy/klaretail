"use client";

import React, { useState, useEffect } from "react";
import VendorLayout from "@/components/vendor/VendorLayout";
import {
  Users,
  UserPlus,
  Shield,
  KeyRound,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Utensils,
  ShoppingCart,
  Flame,
  Power,
  FileCheck2,
  Edit3,
  ShieldCheck,
  UserCheck,
  CreditCard,
  Building2
} from "lucide-react";

interface StaffMember {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  role: "vendor_admin" | "cashier" | "kitchen_staff" | "waiter";
  posPin: string;
  nationalIdNumber?: string;
  emergencyContactPhone?: string;
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
  isActive: boolean;
}

export default function VendorStaffManagementPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [vendorData, setVendorData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modal 1: Add Staff
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"cashier" | "kitchen_staff" | "waiter" | "vendor_admin">("cashier");
  const [posPin, setPosPin] = useState("1234");
  const [nationalIdNumber, setNationalIdNumber] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // Modal 2: Reset Staff Password / PIN
  const [resetModalStaff, setResetModalStaff] = useState<StaffMember | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetNewPin, setResetNewPin] = useState("");

  // Modal 3: Edit KYC / Identity Verification
  const [kycModalStaff, setKycModalStaff] = useState<StaffMember | null>(null);
  const [kycFullName, setKycFullName] = useState("");
  const [kycPhone, setKycPhone] = useState("");
  const [kycNIN, setKycNIN] = useState("");
  const [kycEmergency, setKycEmergency] = useState("");
  const [kycStatus, setKycStatus] = useState<"unverified" | "pending" | "verified" | "rejected">("unverified");

  // Owner Self-Profile & Master Password
  const [ownerBusinessName, setOwnerBusinessName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerNewPassword, setOwnerNewPassword] = useState("");
  const [isOwnerSaving, setIsOwnerSaving] = useState(false);

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/vendor/staff");
      const json = await res.json();
      if (json.success) {
        setStaff(json.staff || []);
        if (json.vendor) {
          setVendorData(json.vendor);
          setOwnerBusinessName(json.vendor.name || "");
          setOwnerPhone(json.vendor.phone || "");
        }
      }
    } catch {
      setStatusMsg({ text: "Failed to load staff records.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phoneNumber) return;

    try {
      const res = await fetch("/api/vendor/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phoneNumber,
          email,
          role,
          posPin,
          nationalIdNumber,
          emergencyContactPhone: emergencyPhone,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      setIsAddModalOpen(false);
      setFullName("");
      setPhoneNumber("");
      setEmail("");
      setNationalIdNumber("");
      setEmergencyPhone("");
      setPosPin("1234");
      setStatusMsg({ text: `Staff member ${fullName} registered.`, type: "success" });
      loadStaff();
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: "error" });
    }
  };

  const handleResetStaffCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalStaff) return;

    try {
      const res = await fetch("/api/vendor/staff/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_staff_credentials",
          staffId: resetModalStaff.id,
          newPassword: resetNewPassword || undefined,
          newPin: resetNewPin || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      setResetModalStaff(null);
      setResetNewPassword("");
      setResetNewPin("");
      setStatusMsg({ text: `Credentials reset for ${resetModalStaff.fullName}.`, type: "success" });
      loadStaff();
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: "error" });
    }
  };

  const handleSaveKYC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycModalStaff) return;

    try {
      const res = await fetch("/api/vendor/staff/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_staff_kyc",
          staffId: kycModalStaff.id,
          kycData: {
            fullName: kycFullName,
            phoneNumber: kycPhone,
            nationalIdNumber: kycNIN,
            emergencyContactPhone: kycEmergency,
            verificationStatus: kycStatus,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      setKycModalStaff(null);
      setStatusMsg({ text: `KYC verified for ${kycFullName}.`, type: "success" });
      loadStaff();
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: "error" });
    }
  };

  const handleSaveOwnerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsOwnerSaving(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/vendor/staff/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_owner_profile",
          ownerProfile: {
            businessName: ownerBusinessName,
            phone: ownerPhone,
            newPassword: ownerNewPassword || undefined,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      setOwnerNewPassword("");
      setStatusMsg({ text: "Owner profile and security credentials updated.", type: "success" });
      loadStaff();
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: "error" });
    } finally {
      setIsOwnerSaving(false);
    }
  };

  const toggleStaffStatus = async (member: StaffMember) => {
    try {
      const nextActive = !member.isActive;
      const res = await fetch("/api/vendor/staff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, isActive: nextActive }),
      });
      const json = await res.json();
      if (json.success) {
        setStaff((prev) =>
          prev.map((s) => (s.id === member.id ? { ...s, isActive: nextActive } : s))
        );
      }
    } catch {}
  };

  const openKycModal = (s: StaffMember) => {
    setKycModalStaff(s);
    setKycFullName(s.fullName);
    setKycPhone(s.phoneNumber);
    setKycNIN(s.nationalIdNumber || "");
    setKycEmergency(s.emergencyContactPhone || "");
    setKycStatus(s.verificationStatus || "unverified");
  };

  const openResetModal = (s: StaffMember) => {
    setResetModalStaff(s);
    setResetNewPassword("");
    setResetNewPin(s.posPin || "1234");
  };

  const getVerificationBadge = (st: string) => {
    switch (st) {
      case "verified":
        return { label: "NIN Verified", styles: "bg-emerald-950/60 text-emerald-400 border-emerald-800/60" };
      case "pending":
        return { label: "Pending Check", styles: "bg-amber-950/60 text-amber-400 border-amber-800/60" };
      case "rejected":
        return { label: "Rejected", styles: "bg-rose-950/60 text-rose-400 border-rose-800/60" };
      default:
        return { label: "Unverified", styles: "bg-slate-800 text-slate-400 border-slate-700" };
    }
  };

  return (
    <VendorLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6 pb-24 font-mono">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Staff Identity & Security Manager</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Reset staff PINs & passwords, inspect national identity (NIN) KYC, and manage owner credentials.
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white transition flex items-center gap-1.5 shadow-lg shadow-emerald-950"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        </div>

        {/* Toast */}
        {statusMsg && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              statusMsg.type === "success"
                ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/50"
                : "bg-rose-950/40 text-rose-300 border-rose-800/50"
            }`}
          >
            {statusMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Section 1: Staff Roster Table */}
        <div className="bg-[#121620] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>STAFF ROSTER & SECURITY ({staff.length})</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#161a26] text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Staff Name & Contact</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">POS PIN</th>
                  <th className="p-3.5">National ID (NIN)</th>
                  <th className="p-3.5">Verification</th>
                  <th className="p-3.5">Active</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Loading staff records...
                    </td>
                  </tr>
                ) : staff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      No staff members registered.
                    </td>
                  </tr>
                ) : (
                  staff.map((s) => {
                    const vBadge = getVerificationBadge(s.verificationStatus);
                    return (
                      <tr key={s.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-3.5">
                          <div className="font-bold text-white">{s.fullName}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{s.phoneNumber}</span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 uppercase text-[10px]">
                            {s.role.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                            •••• ({s.posPin || "1234"})
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-300">
                          {s.nationalIdNumber ? (
                            <span className="text-emerald-400 font-bold">{s.nationalIdNumber}</span>
                          ) : (
                            <span className="text-slate-500 italic">Not Submitted</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${vBadge.styles}`}>
                            {vBadge.label}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <button
                            onClick={() => toggleStaffStatus(s)}
                            className={`p-1.5 rounded-lg border transition ${
                              s.isActive
                                ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-400 hover:bg-rose-950/40 hover:text-rose-400"
                                : "bg-rose-950/40 border-rose-800/60 text-rose-400 hover:bg-emerald-950/40 hover:text-emerald-400"
                            }`}
                            title={s.isActive ? "Suspend Access" : "Activate"}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            onClick={() => openKycModal(s)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Inspect / Verify KYC"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openResetModal(s)}
                            className="p-1.5 rounded-lg bg-orange-950/40 border border-orange-800/60 text-orange-300 hover:bg-orange-900/60 transition"
                            title="Reset Password / POS PIN"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Store Owner Identity & Master Password */}
        <div className="bg-[#121620] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>OWNER CREDENTIALS & MASTER SECURITY</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Admin Access
            </span>
          </div>

          <form onSubmit={handleSaveOwnerProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 mb-1">Store / Business Name</label>
                <input
                  type="text"
                  required
                  value={ownerBusinessName}
                  onChange={(e) => setOwnerBusinessName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-sans focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Primary Owner Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="+256700000000"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">
                Change Master Owner Password (Leave blank to keep current)
              </label>
              <input
                type="password"
                placeholder="Enter new strong owner password..."
                value={ownerNewPassword}
                onChange={(e) => setOwnerNewPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isOwnerSaving}
                className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-950 disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isOwnerSaving ? "Saving..." : "Save Owner Profile & Password"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* MODAL 1: Add Staff */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121620] border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>REGISTER STAFF MEMBER</span>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddStaff} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Grace Nalubega"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">Phone (Login) *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+256700000000"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Emergency Phone</label>
                    <input
                      type="tel"
                      placeholder="+256770000000"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">Assigned Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                    >
                      <option value="cashier">Cashier (POS)</option>
                      <option value="kitchen_staff">Kitchen Master (KDS)</option>
                      <option value="waiter">Table Server</option>
                      <option value="vendor_admin">Store Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">POS PIN (4-Digits)</label>
                    <input
                      type="password"
                      maxLength={4}
                      value={posPin}
                      onChange={(e) => setPosPin(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white text-center font-bold tracking-widest"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">National Identification Number (NIN)</label>
                  <input
                    type="text"
                    placeholder="CM98000000XXXX (Uganda NIN)"
                    value={nationalIdNumber}
                    onChange={(e) => setNationalIdNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white uppercase"
                  />
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    Save Staff
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: Reset Staff Password / PIN */}
        {resetModalStaff && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121620] border border-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <KeyRound className="w-4 h-4 text-orange-400" />
                  <span>RESET CREDENTIALS</span>
                </div>
                <button onClick={() => setResetModalStaff(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Updating credentials for <span className="text-white font-bold">{resetModalStaff.fullName}</span> ({resetModalStaff.role}).
              </p>

              <form onSubmit={handleResetStaffCredentials} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Set New Web Password</label>
                  <input
                    type="password"
                    placeholder="Enter new password..."
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Set New POS PIN (4 Digits)</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="e.g. 5678"
                    value={resetNewPin}
                    onChange={(e) => setResetNewPin(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white text-center font-bold tracking-widest"
                  />
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setResetModalStaff(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold"
                  >
                    Update
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: KYC & Identity Verification */}
        {kycModalStaff && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121620] border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  <span>IDENTITY & KYC VERIFICATION</span>
                </div>
                <button onClick={() => setKycModalStaff(null)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveKYC} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    value={kycFullName}
                    onChange={(e) => setKycFullName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      required
                      value={kycPhone}
                      onChange={(e) => setKycPhone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Emergency Phone</label>
                    <input
                      type="tel"
                      placeholder="+256770000000"
                      value={kycEmergency}
                      onChange={(e) => setKycEmergency(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">National ID Number (NIN)</label>
                  <input
                    type="text"
                    placeholder="CM98000000XXXX"
                    value={kycNIN}
                    onChange={(e) => setKycNIN(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white uppercase font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Verification Status</label>
                  <select
                    value={kycStatus}
                    onChange={(e) => setKycStatus(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-bold"
                  >
                    <option value="verified">Verified (Physical ID Checked)</option>
                    <option value="pending">Pending Document Submission</option>
                    <option value="unverified">Unverified</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setKycModalStaff(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  >
                    Save Verification
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </VendorLayout>
  );
}
