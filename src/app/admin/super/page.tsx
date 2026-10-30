'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface PlatformMetrics {
  totals: {
    gmv: number;
    netPlatformRevenue: number;
    retainedCommission?: number;
    merchantPayableVolume?: number;
    codVolume?: number;
    digitalVolume?: number;
    codCollected: number;
    totalOrders: number;
    deliveredOrders: number;
    activeDispatches: number;
    kitchenBacklog?: number;
    feeBreakdown: {
      service: number;
      convenience: number;
      delivery: number;
    };
  };
  entities: {
    admins: number;
    vendors: number;
    activeVendors?: number;
    riders: number;
    activeRiders: number;
    lockedRiders?: number;
    customers: number;
  };
  fleetRisk: Array<{
    id: string;
    rider_name: string;
    rider_phone: string;
    vehicle_plate: string;
    total_cash_collected: string | number;
    max_cash_limit?: string | number;
    is_locked?: boolean;
    active_deliveries: number;
  }>;
  recentSettlements: Array<{
    id: string;
    order_number: string;
    status: string;
    payment_method: string;
    total_amount: number;
    delivery_pin: string | null;
    cod_cash_received: string | number;
    cod_verified_at: string | null;
    created_at: string;
    customer_phone: string | null;
    rider_name: string | null;
    vendor_name?: string | null;
  }>;
}

interface VendorRecord {
  status?: string;
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  ownerPhone: string;
  latitude: number;
  longitude: number;
  defaultSlotCapacity: number;
  isAcceptingOrders: boolean;
  commissionBps: number;
  isVerified: boolean;
  payoutStatus: string;
  totalOrders: number;
  grossSales: number;
  createdAt: string;
}

interface RiderRecord {
  id: string;
  name: string;
  phone: string;
  vehiclePlate: string;
  isActive: boolean;
  isLocked: boolean;
  maxCashLimit: number;
  totalCashSettled: number;
  currentCashAtRisk: number;
  completedDeliveries: number;
  activeDeliveries: number;
  utilizationPct: number;
}

interface UserRecord {
  id: string;
  phone: string;
  role: string;
  trustLevel: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuditRecord {
  id: string;
  actorId: string | null;
  actorRole: string;
  actorPhone: string | null;
  action: string;
  targetEntity: string;
  targetId: string | null;
  metadata: Record<string, any>;
  ipAddress: string | null;
  createdAt: string;
}

export default function SuperAdminExecutiveConsole() {
  const [data, setData] = useState<PlatformMetrics | null>(null);
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [riders, setRiders] = useState<RiderRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'vendors' | 'cockpit' | 'fleet' | 'rbac' | 'audit'>('vendors');
  const [loading, setLoading] = useState(false);
  const [authBanner, setAuthBanner] = useState<string | null>(null);

  // Vendor Commission Editing
  const [editingCommissionId, setEditingCommissionId] = useState<string | null>(null);
  const [newCommissionVal, setNewCommissionVal] = useState<string>('');

  // Create Vendor Modal State
  const [showCreateVendorModal, setShowCreateVendorModal] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    name: '',
    slug: '',
    ownerPhone: '',
    commissionBps: '1000',
    defaultSlotCapacity: '5',
    latitude: '0.347596',
    longitude: '32.582520'
  });
  const [createVendorLoading, setCreateVendorLoading] = useState(false);
  const [createVendorError, setCreateVendorError] = useState<string | null>(null);

  // Rider Onboarding & Cash Clearance State
  const [showCreateRiderModal, setShowCreateRiderModal] = useState(false);
  const [riderForm, setRiderForm] = useState({ name: "", phone: "+256", vehiclePlate: "U" });
  const [createRiderLoading, setCreateRiderLoading] = useState(false);
  const [createRiderError, setCreateRiderError] = useState<string | null>(null);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // URL query sync
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && ['cockpit', 'vendors', 'fleet', 'rbac', 'audit'].includes(tab)) {
        setActiveTab(tab as any);
      }
    }
  }, []);

  const switchTab = (tab: 'cockpit' | 'vendors' | 'fleet' | 'rbac' | 'audit') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Self-authorizing master trigger
  const triggerMasterAuth = async () => {
    try {
      const res = await fetch('/api/auth/super-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ passkey: 'platform_master' })
      });
      const json = await res.json();
      if (json.success) {
        setAuthBanner('Master session authenticated.');
        setTimeout(() => setAuthBanner(null), 3500);
        await fetchAll();
      }
    } catch (err: any) {
      console.error('Master authorization error', err);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch("/api/admin/super/rbac", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, action: "change_role", newRole })
      });
      const json = await res.json();
      if (!res.ok || !json.success) alert(json.message || "Failed to update role");
      await fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleUserActive = async (userId: string) => {
    try {
      const res = await fetch("/api/admin/super/rbac", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, action: "toggle_active" })
      });
      const json = await res.json();
      if (!res.ok || !json.success) alert(json.message || "Failed to toggle account status");
      await fetchAll();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch('/api/admin/super/vendors', { credentials: 'include' });
      if (res.status === 403) {
        await triggerMasterAuth();
        return;
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.vendors)) {
        setVendors(json.vendors);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/admin/super/metrics', { credentials: 'include' });
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateRider = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateRiderLoading(true);
    setCreateRiderError(null);
    try {
      const res = await fetch("/api/admin/super/riders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "create_rider",
          name: riderForm.name,
          phone: riderForm.phone,
          vehiclePlate: riderForm.vehiclePlate
        })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to onboard courier.");
      setShowCreateRiderModal(false);
      setRiderForm({ name: "", phone: "+256", vehiclePlate: "U" });
      await fetchRiders();
    } catch (err: any) {
      setCreateRiderError(err.message);
    } finally {
      setCreateRiderLoading(false);
    }
  };

  const handleClearCash = async (riderId: string, name: string) => {
    if (!confirm(`Verify physical remittance and reset cash on hand to UGX 0 for courier ${name}?`)) return;
    setActionInProgressId(riderId);
    try {
      const res = await fetch("/api/admin/super/riders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "clear_cash", riderId })
      });
      const json = await res.json();
      if (!res.ok || !json.success) alert(json.message || "Remittance clearance failed.");
      await fetchRiders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleToggleLock = async (riderId: string) => {
    setActionInProgressId(riderId);
    try {
      const res = await fetch("/api/admin/super/riders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "toggle_lock", riderId })
      });
      const json = await res.json();
      if (!res.ok || !json.success) alert(json.message || "Failed to toggle lock.");
      await fetchRiders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionInProgressId(null);
    }
  };

  const fetchRiders = async () => {
    try {
      const res = await fetch('/api/admin/super/riders', { credentials: 'include' });
      const json = await res.json();
      if (json.success && Array.isArray(json.riders)) setRiders(json.riders);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/super/rbac', { credentials: 'include' });
      const json = await res.json();
      if (json.success && Array.isArray(json.users)) setUsers(json.users);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/super/audit', { credentials: 'include' });
      const json = await res.json();
      if (json.success && Array.isArray(json.logs)) setAuditLogs(json.logs);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.allSettled([
      fetchVendors(),
      fetchMetrics(),
      fetchRiders(),
      fetchUsers(),
      fetchAuditLogs()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreateVendorLoading(true);
      setCreateVendorError(null);
      const res = await fetch('/api/admin/super/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(vendorForm)
      });
      const json = await res.json();
      if (json.success) {
        setShowCreateVendorModal(false);
        setVendorForm({
          name: '',
          slug: '',
          ownerPhone: '',
          commissionBps: '1000',
          defaultSlotCapacity: '5',
          latitude: '0.347596',
          longitude: '32.582520'
        });
        fetchVendors();
        fetchAuditLogs();
      } else {
        setCreateVendorError(json.message || 'Creation failed');
      }
    } catch (err: any) {
      setCreateVendorError(err.message || 'Network error');
    } finally {
      setCreateVendorLoading(false);
    }
  };

  const handleUpdateCommission = async (vendorId: string) => {
    const bps = parseInt(newCommissionVal, 10);
    if (isNaN(bps)) return;
    const res = await fetch('/api/admin/super/vendors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ vendorId, action: 'set_commission', value: bps })
    });
    const json = await res.json();
    if (json.success) {
      setEditingCommissionId(null);
      fetchVendors();
      fetchAuditLogs();
    } else {
      alert(json.message);
    }
  };

  const handleToggleVerification = async (vendorId: string) => {
    const res = await fetch('/api/admin/super/vendors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ vendorId, action: 'toggle_verification' })
    });
    const json = await res.json();
    if (json.success) {
      fetchVendors();
      fetchAuditLogs();
    }
  };

  const handleVendorApproval = async (vendorId: string, action: "approve" | "reject" | "suspend") => {
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || "Action failed");
        return;
      }
      if (typeof fetchVendors === "function") {
        fetchVendors();
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    }
  };

  const handleToggleOrders = async (vendorId: string) => {
    const res = await fetch('/api/admin/super/vendors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ vendorId, action: 'toggle_orders' })
    });
    const json = await res.json();
    if (json.success) {
      fetchVendors();
      fetchAuditLogs();
    }
  };

  const handleSetPayoutStatus = async (vendorId: string, status: string) => {
    const res = await fetch('/api/admin/super/vendors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ vendorId, action: 'set_payout_status', value: status })
    });
    const json = await res.json();
    if (json.success) {
      fetchVendors();
      fetchAuditLogs();
    }
  };

  const formatUGX = (val: number) => 'UGX ' + Number(val || 0).toLocaleString('en-US');

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-200 font-sans flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      {/* Institutional Top Control Bar */}
      <header className="border-b border-slate-800/80 bg-[#0b0e14] px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            <span className="font-mono text-xs font-black tracking-widest uppercase text-white">
              KLARETAIL // EXECUTIVE PLATFORM CONTROL
            </span>
          </div>
          <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded">
            SUPER ADMIN TIER-0
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <Link
            href="/admin"
            className="text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-900 border border-slate-800 transition"
          >
            &larr; Dispatch Ops
          </Link>

          <button
            onClick={triggerMasterAuth}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded transition text-xs shadow-[0_0_12px_rgba(245,158,11,0.2)] cursor-pointer"
          >
            Re-Authorize Session
          </button>
        </div>
      </header>

      {authBanner && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-300 text-xs font-mono py-2 px-6 text-center">
          {authBanner}
        </div>
      )}

      {/* Main Container */}
      <div className="flex flex-1">
        {/* Navigation Rail */}
        <aside className="w-64 border-r border-slate-800/80 bg-[#090c12] p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold px-3 mb-2">
                Governance Domains
              </div>
              <div className="space-y-1.5">
                {[
                  { id: 'vendors', label: 'Merchant Governance', icon: '🏬', badge: vendors.length },
                  { id: 'cockpit', label: 'Platform Cockpit', icon: '🏛️' },
                  { id: 'fleet', label: 'Fleet & Cash Sentinel', icon: '⚡', badge: riders.length },
                  { id: 'rbac', label: 'Staff & RBAC Matrix', icon: '🛡️', badge: users.length },
                  { id: 'audit', label: 'Audit Trail Ledger', icon: '📜', badge: auditLogs.length },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => switchTab(item.id as any)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${
                      activeTab === item.id
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-inner font-bold'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        activeTab === item.id 
                          ? 'bg-emerald-500 text-slate-950' 
                          : 'bg-slate-800 border border-slate-700 text-slate-300'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-2 text-xs font-mono">
              <div className="text-[10px] uppercase text-slate-500 font-bold">Platform State</div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Stores:</span>
                <span className="text-emerald-400 font-bold">{vendors.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Active Fleet:</span>
                <span className="text-amber-400 font-bold">{riders.filter(r => r.isActive && !r.isLocked).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Settled Orders:</span>
                <span className="text-cyan-400 font-bold">{data?.totals.deliveredOrders || 0}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Dynamic Canvas */}
        <main className="flex-1 p-8 space-y-8 overflow-y-auto max-w-7xl">
          {/* TAB: VENDORS */}
          {activeTab === 'vendors' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                <div>
                  <h1 className="text-2xl font-bold font-mono text-white flex items-center gap-2">
                    <span>🏬</span> Merchant Governance &amp; Store Directory
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Onboard new merchants, configure commission BPS overrides, manage order intake, and enforce payout holds.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowCreateVendorModal(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs rounded-lg transition flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
                  >
                    <span>+</span> Onboard New Vendor
                  </button>
                  <button
                    onClick={fetchVendors}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition cursor-pointer"
                  >
                    Refresh List
                  </button>
                </div>
              </div>

              {/* Vendors Table */}
              <div className="bg-[#0b0e14] border border-slate-800/90 rounded-xl p-6 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800 pb-3">
                        <th className="py-2.5">Store / Brand Name</th>
                        <th>Owner &amp; Coordinates</th>
                        <th>Commission (BPS)</th>
                        <th>Order Intake</th>
                        <th>Verification</th>
                        <th>Payout Status</th>
                        <th className="text-right">Settled Volume</th>
                        <th className="text-right pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {vendors.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-3.5">
                            <div className="font-bold text-white text-sm">{v.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">slug: /{v.slug}</div>
                          </td>
                          <td className="text-slate-300">
                            <div>{v.ownerPhone}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {Number(v.latitude || 0).toFixed(4)}, {Number(v.longitude || 0).toFixed(4)} &bull; {v.defaultSlotCapacity} slots
                            </div>
                          </td>
                          <td>
                            {editingCommissionId === v.id ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  className="w-20 bg-slate-900 border border-amber-500/50 rounded px-2 py-0.5 text-xs text-amber-300 font-mono"
                                  placeholder="BPS"
                                  value={newCommissionVal}
                                  onChange={(e) => setNewCommissionVal(e.target.value)}
                                />
                                <button
                                  onClick={() => handleUpdateCommission(v.id)}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingCommissionId(null)}
                                  className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px] cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingCommissionId(v.id);
                                  setNewCommissionVal(String(v.commissionBps));
                                }}
                                className="group flex items-center gap-1 text-amber-300 hover:underline cursor-pointer"
                              >
                                <span className="font-bold">{(v.commissionBps / 100).toFixed(2)}%</span>
                                <span className="text-[10px] text-slate-500">({v.commissionBps} bps) ✎</span>
                              </button>
                            )}
                          </td>
                          <td>
                            <button
                              onClick={() => handleToggleOrders(v.id)}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase border transition cursor-pointer ${
                                v.isAcceptingOrders
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                              }`}
                            >
                              {v.isAcceptingOrders ? 'Accepting Orders' : 'Intake Paused'}
                            </button>
                          </td>
                          <td>
                            <button
                              onClick={() => handleToggleVerification(v.id)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition cursor-pointer ${
                                v.isVerified
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                              }`}
                            >
                              {v.isVerified ? '✓ Verified' : '✕ Unverified'}
                            </button>
                          </td>
                          <td>
                            <select
                              value={v.payoutStatus}
                              onChange={(e) => handleSetPayoutStatus(v.id, e.target.value)}
                              className={`bg-slate-900 border rounded px-2.5 py-1 text-[11px] font-mono cursor-pointer ${
                                v.payoutStatus === 'active'
                                  ? 'text-emerald-400 border-emerald-500/30'
                                  : v.payoutStatus === 'frozen'
                                  ? 'text-rose-400 border-rose-500/30'
                                  : 'text-amber-400 border-amber-500/30'
                              }`}
                            >
                              <option value="active">Active Payouts</option>
                              <option value="frozen">Frozen (Hold)</option>
                              <option value="under_review">Under Review</option>
                            </select>
                          </td>
                          <td className="text-right text-white font-semibold">
                            {formatUGX(v.grossSales)}
                            <div className="text-[10px] text-slate-500">{v.totalOrders} total orders</div>
                          </td>
                                                  <td className="text-right py-3.5 pr-4">
                            <div className="flex items-center justify-end gap-1.5">
                              {v.status === "pending_approval" || !v.isAcceptingOrders ? (
                                <button
                                  onClick={() => handleVendorApproval(v.id, "approve")}
                                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer"
                                  title="Approve Business"
                                >
                                  Approve
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleVendorApproval(v.id, "suspend")}
                                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800 transition cursor-pointer"
                                  title="Suspend Business"
                                >
                                  Suspend
                                </button>
                              )}
                            </div>
                          </td>
                      </tr>
                      ))}

                      {vendors.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center py-10 text-slate-500 font-mono">
                            No merchants found. Click "+ Onboard New Vendor" to register a store.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: COCKPIT */}
          {activeTab === "cockpit" && (
            <div className="space-y-8">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                <div>
                  <h1 className="text-2xl font-bold font-mono text-white flex items-center gap-2">
                    <span>🏛️</span> Executive Platform Cockpit
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Live capital flow, digital float vs. physical COD liquidity, and merchant payout exposure across Kampala.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={fetchAll}
                    className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 text-xs font-mono transition flex items-center gap-2 shadow"
                  >
                    <span>↻</span> Force Telemetry Sync
                  </button>
                </div>
              </div>

              {/* Primary Financial Telemetry Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#0b0e14] border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">Gross Merchandise Vol (GMV)</div>
                  <div className="text-2xl font-bold font-mono text-white mt-2">{formatUGX(data?.totals.gmv || 0)}</div>
                  <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                    <span>Delivered Orders:</span>
                    <span className="text-slate-300 font-bold">{data?.totals.deliveredOrders || 0} / {data?.totals.totalOrders || 0}</span>
                  </div>
                </div>

                <div className="bg-[#0b0e14] border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">Net Platform Margin</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">{formatUGX(data?.totals.netPlatformRevenue || 0)}</div>
                  <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                    <span>Retained Commission:</span>
                    <span className="text-emerald-300 font-bold">{formatUGX(data?.totals.retainedCommission || 0)}</span>
                  </div>
                </div>

                <div className="bg-[#0b0e14] border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold">Digital MoMo / Card Float</div>
                  <div className="text-2xl font-bold font-mono text-cyan-400 mt-2">{formatUGX(data?.totals.digitalVolume || 0)}</div>
                  <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                    <span>Prepaid Digital Share:</span>
                    <span className="text-cyan-300 font-bold">
                      {data?.totals.gmv ? Math.round(((data?.totals.digitalVolume || 0) / data.totals.gmv) * 100) : 0}%
                    </span>
                  </div>
                </div>

                <div className="bg-[#0b0e14] border border-slate-800/90 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold">Merchant Payout Liability</div>
                  <div className="text-2xl font-bold font-mono text-amber-400 mt-2">{formatUGX(data?.totals.merchantPayableVolume || 0)}</div>
                  <div className="text-[10px] text-slate-500 mt-1 flex justify-between">
                    <span>Due on Payout Run:</span>
                    <span className="text-amber-300 font-bold">{vendors.length} Active Stores</span>
                  </div>
                </div>
              </div>

              {/* Operational Velocity & Backlog Tracker */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#090c12] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Kitchen Prep Backlog</div>
                    <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                      {data?.totals.kitchenBacklog || 0} Tickets
                    </div>
                  </div>
                  <span className="text-2xl">🍳</span>
                </div>

                <div className="bg-[#090c12] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Road Dispatches In Transit</div>
                    <div className="text-xl font-bold font-mono text-cyan-400 mt-1">
                      {data?.totals.activeDispatches || 0} Active Trips
                    </div>
                  </div>
                  <span className="text-2xl">🛵</span>
                </div>

                <div className="bg-[#090c12] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Fleet Operational Ratio</div>
                    <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                      {riders.filter(r => !r.isLocked).length} / {riders.length} Unlocked
                    </div>
                  </div>
                  <span className="text-2xl">⚡</span>
                </div>
              </div>

              {/* High-Exposure Street Cash & Recent Settlements Matrix */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Couriers Cash at Risk */}
                <div className="bg-[#0b0e14] border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h2 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-2">
                      <span>⚡</span> High-Exposure Fleet COD
                    </h2>
                    <span className="text-[10px] text-slate-500">UGX 50k Limit</span>
                  </div>

                  <div className="space-y-3">
                    {(!data?.fleetRisk || data.fleetRisk.length === 0) ? (
                      <div className="text-xs text-slate-500 py-4 text-center font-mono">No couriers carrying cash</div>
                    ) : (
                      data.fleetRisk.map((r) => {
                        const cash = Number(r.total_cash_collected || 0);
                        const limit = 50000;
                        const pct = Math.min(100, Math.round((cash / limit) * 100));
                        const isLocked = cash >= limit || r.is_locked;

                        return (
                          <div key={r.id} className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-bold text-white text-xs">{r.rider_name}</div>
                                <div className="text-[10px] text-slate-400">{r.vehicle_plate || "NO-PLATE"} • {r.rider_phone}</div>
                              </div>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                isLocked ? "bg-rose-950/60 text-rose-300 border-rose-800/50" : "bg-slate-800 text-slate-300 border-slate-700"
                              }`}>
                                {isLocked ? "LOCKED" : "READY"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-mono">
                              <span className={cash >= limit ? "text-rose-400 font-bold" : "text-amber-300"}>
                                {formatUGX(cash)}
                              </span>
                              <span className="text-slate-500">/ UGX 50,000</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full ${isLocked ? "bg-rose-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Live Settlement Ledger */}
                <div className="lg:col-span-2 bg-[#0b0e14] border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h2 className="text-xs font-bold font-mono text-white uppercase tracking-wider flex items-center gap-2">
                      <span>📜</span> Real-Time Settlement & Handover Feed
                    </h2>
                    <span className="text-[10px] text-slate-500">Latest 10 Events</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-800/60 pb-2">
                          <th className="py-2">Order #</th>
                          <th>Store / Merchant</th>
                          <th>Customer Phone</th>
                          <th>Method</th>
                          <th>Amount</th>
                          <th>PIN Verification</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {(!data?.recentSettlements || data.recentSettlements.length === 0) ? (
                          <tr>
                            <td colSpan={8} className="py-6 text-center text-slate-500">No settlement records available.</td>
                          </tr>
                        ) : (
                          data.recentSettlements.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-900/40 transition">
                              <td className="py-2.5 font-bold text-white">{s.order_number}</td>
                              <td className="text-slate-300 truncate max-w-[120px]">{s.vendor_name || "Store"}</td>
                              <td className="text-slate-400">{s.customer_phone || "Anonymous"}</td>
                              <td>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                  s.payment_method?.toLowerCase().includes("cod")
                                    ? "bg-amber-950/50 text-amber-300 border border-amber-800/40"
                                    : "bg-cyan-950/50 text-cyan-300 border border-cyan-800/40"
                                }`}>
                                  {s.payment_method?.toUpperCase()}
                                </span>
                              </td>
                              <td className="font-bold text-white">{formatUGX(s.total_amount)}</td>
                              <td>
                                {s.delivery_pin ? (
                                  <span className="text-slate-300 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                                    {s.delivery_pin}
                                  </span>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>
                              <td>
                                <span className={`text-[10px] font-semibold ${
                                  s.status === "delivered"
                                    ? "text-emerald-400"
                                    : s.status === "dispatched"
                                    ? "text-cyan-400"
                                    : "text-amber-400"
                                }`}>
                                  ● {s.status.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: FLEET */}
          {activeTab === "fleet" && (
            <div className="space-y-6">
              {/* Header & Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold font-mono text-white">Fleet & Cash Sentinel</h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Enforce the UGX 50,000 cash threshold, sign off physical remittances, and onboard licensed couriers.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCreateRiderModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition"
                  >
                    + Onboard New Courier
                  </button>
                  <button
                    onClick={fetchRiders}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs transition"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Sentinel Liquidity Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#0b0e14] border border-slate-800/90 rounded-2xl p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Cash In Transit</div>
                  <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                    {formatUGX(riders.reduce((acc, r) => acc + Number(r.currentCashAtRisk || 0), 0))}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Unremitted customer cash on the road</div>
                </div>

                <div className="bg-[#0b0e14] border border-slate-800/90 rounded-2xl p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Locked / Over Ceiling</div>
                  <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                    {riders.filter(r => r.isLocked || Number(r.currentCashAtRisk || 0) >= 50000).length} Couriers
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Exceeded UGX 50,000 threshold policy</div>
                </div>

                <div className="bg-[#0b0e14] border border-slate-800/90 rounded-2xl p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active Operational Fleet</div>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                    {riders.filter(r => !r.isLocked).length} / {riders.length} Ready
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Eligible to receive new delivery tasks</div>
                </div>
              </div>

              {/* Enhanced Couriers Table */}
              <div className="bg-[#0b0e14] border border-slate-800/90 rounded-2xl overflow-hidden p-6 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800/80 pb-3">
                        <th className="py-3 px-2">Courier Profile</th>
                        <th className="px-2">Vehicle Plate</th>
                        <th className="px-2">Cash on Hand / Limit</th>
                        <th className="px-2">Total Settled</th>
                        <th className="px-2">State</th>
                        <th className="px-2 text-right">Fiscal Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {riders.map((r) => {
                        const cash = Number(r.currentCashAtRisk || 0);
                        const limit = Number(r.maxCashLimit || 50000);
                        const pct = Math.min(100, Math.round((cash / limit) * 100));
                        const isOverLimit = cash >= limit;
                        const isManuallyLocked = r.isLocked && !isOverLimit;
                        const isOver = isOverLimit || isManuallyLocked;

                        return (
                          <tr key={r.id} className="hover:bg-slate-900/40 transition">
                            <td className="py-3.5 px-2">
                              <div className="font-bold text-white text-sm">{r.name}</div>
                              <div className="text-[11px] text-slate-400 font-sans">{r.phone}</div>
                            </td>
                            <td className="px-2">
                              <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 text-[11px]">
                                {r.vehiclePlate || "NO-PLATE"}
                              </span>
                            </td>
                            <td className="px-2">
                              <div className="flex items-center justify-between text-[11px] mb-1">
                                <span className={isOver ? "text-rose-400 font-bold" : "text-amber-300 font-medium"}>
                                  {formatUGX(cash)}
                                </span>
                                <span className="text-slate-500">/ {formatUGX(limit)}</span>
                              </div>
                              <div className="w-36 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full ${isOver ? "bg-rose-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </td>
                            <td className="px-2 text-emerald-400 font-bold">
                              {formatUGX(r.totalCashSettled)}
                            </td>
                            <td className="px-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  isOverLimit
                                    ? "bg-rose-950/60 text-rose-300 border-rose-800/50"
                                    : isManuallyLocked
                                    ? "bg-amber-950/60 text-amber-300 border-amber-800/50"
                                    : "bg-emerald-950/60 text-emerald-300 border-emerald-800/50"
                                }`}
                              >
                                {isOverLimit ? "● Tripped (Cap)" : isManuallyLocked ? "● Admin Locked" : "● Active Ready"}
                              </span>
                            </td>
                            <td className="px-2 text-right space-x-2">
                              <button
                                onClick={() => handleClearCash(r.id, r.name)}
                                disabled={actionInProgressId === r.id}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-600/40 text-[11px] font-semibold transition disabled:opacity-50"
                              >
                                Verify Remittance
                              </button>
                              <button
                                onClick={() => handleToggleLock(r.id)}
                                disabled={actionInProgressId === r.id}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition disabled:opacity-50"
                              >
                                {r.isLocked ? "Unlock" : "Lock"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Onboard Courier Modal Dialog */}
              {showCreateRiderModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                  <div className="w-full max-w-md bg-[#0f131a] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <h2 className="text-base font-bold text-white font-mono">Onboard New Courier</h2>
                      <button
                        onClick={() => setShowCreateRiderModal(false)}
                        className="text-slate-400 hover:text-white text-lg font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    {createRiderError && (
                      <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-300">
                        {createRiderError}
                      </div>
                    )}

                    <form onSubmit={handleCreateRider} className="space-y-4 font-sans text-xs">
                      <div>
                        <label className="block font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                          Courier Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={riderForm.name}
                          onChange={(e) => setRiderForm({ ...riderForm, name: e.target.value })}
                          placeholder="e.g. Samuel Ssemwogerere"
                          className="mt-1 w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                          Phone Number (MTN / Airtel Uganda)
                        </label>
                        <input
                          type="tel"
                          required
                          value={riderForm.phone}
                          onChange={(e) => setRiderForm({ ...riderForm, phone: e.target.value })}
                          placeholder="+256770123456"
                          className="mt-1 w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                          Motorcycle / Vehicle Plate Number
                        </label>
                        <input
                          type="text"
                          required
                          value={riderForm.vehiclePlate}
                          onChange={(e) => setRiderForm({ ...riderForm, vehiclePlate: e.target.value.toUpperCase() })}
                          placeholder="UFA 421B"
                          className="mt-1 w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                        <span className="font-semibold text-amber-400">Automatic Policy Enforcement:</span> All new couriers are assigned a default cash ceiling of <strong className="text-white">UGX 50,000</strong>. Crossing this threshold automatically trips the lock until remittances are cleared.
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowCreateRiderModal(false)}
                          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={createRiderLoading}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow transition disabled:opacity-50"
                        >
                          {createRiderLoading ? "Registering..." : "Complete Onboarding"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: RBAC */}
          {activeTab === "rbac" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                <div>
                  <h1 className="text-2xl font-bold font-mono text-white flex items-center gap-2">
                    <span>🛡️</span> Staff & RBAC Governance Matrix
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Manage institutional platform roles, adjust security trust levels, and suspend compromised accounts.
                  </p>
                </div>
                <button
                  onClick={fetchAll}
                  className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-mono transition"
                >
                  ↻ Refresh Staff
                </button>
              </div>

              <div className="bg-[#0b0e14] border border-slate-800/90 rounded-2xl overflow-hidden p-6 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800/80 pb-3">
                        <th className="py-3 px-2">User Identity</th>
                        <th className="px-2">Platform Role</th>
                        <th className="px-2">Trust Level</th>
                        <th className="px-2">Account State</th>
                        <th className="px-2 text-right">Access Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-3.5 px-2">
                            <div className="font-bold text-white text-sm">{u.phone}</div>
                            <div className="text-[10px] text-slate-500 font-mono">ID: {u.id.slice(0, 8)}...</div>
                          </td>
                          <td className="px-2">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              className="bg-slate-900 border border-slate-700 text-amber-300 font-bold rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                            >
                              <option value="super_admin">super_admin (Tier-0)</option>
                              <option value="admin">admin (Dispatch Ops)</option>
                              <option value="vendor_owner">vendor_owner (Merchant)</option>
                              <option value="rider">rider (Courier)</option>
                              <option value="customer">customer</option>
                            </select>
                          </td>
                          <td className="px-2">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-200 font-bold">{u.trustLevel || 0}/100</span>
                              <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full bg-cyan-400"
                                  style={{ width: `${Math.min(100, u.trustLevel || 0)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-2">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                u.isActive
                                  ? "bg-emerald-950/60 text-emerald-300 border-emerald-800/50"
                                  : "bg-rose-950/60 text-rose-300 border-rose-800/50"
                              }`}
                            >
                              {u.isActive ? "● Active" : "● Suspended"}
                            </span>
                          </td>
                          <td className="px-2 text-right">
                            <button
                              onClick={() => handleToggleUserActive(u.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                                u.isActive
                                  ? "bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800/50"
                                  : "bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/50"
                              }`}
                            >
                              {u.isActive ? "Suspend Access" : "Reactivate"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: AUDIT */}
          {activeTab === "audit" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
                <div>
                  <h1 className="text-2xl font-bold font-mono text-white flex items-center gap-2">
                    <span>📜</span> Platform Audit Trail Ledger
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Immutable event log of all privileged mutations, role escalations, and financial adjustments.
                  </p>
                </div>
                <button
                  onClick={fetchAll}
                  className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-mono transition"
                >
                  ↻ Refresh Ledger
                </button>
              </div>

              <div className="bg-[#0b0e14] border border-slate-800/90 rounded-2xl overflow-hidden p-6 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800/80 pb-3">
                        <th className="py-3 px-2">Timestamp</th>
                        <th className="px-2">Action</th>
                        <th className="px-2">Actor</th>
                        <th className="px-2">Target</th>
                        <th className="px-2">Payload Metadata</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {auditLogs.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-3 px-2 text-slate-400 whitespace-nowrap">
                            <div>{new Date(l.createdAt).toLocaleTimeString()}</div>
                            <div className="text-[10px] text-slate-600">{new Date(l.createdAt).toLocaleDateString()}</div>
                          </td>
                          <td className="px-2">
                            <span className="px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/50 text-amber-300 font-bold text-[10px]">
                              {l.action}
                            </span>
                          </td>
                          <td className="px-2">
                            <div className="text-slate-300 font-bold">{l.actorRole || "SYSTEM"}</div>
                            {l.actorPhone && <div className="text-[10px] text-slate-500">{l.actorPhone}</div>}
                          </td>
                          <td className="px-2 text-slate-300">
                            <span className="text-cyan-400 font-semibold">{l.targetEntity}</span>
                            {l.targetId && <div className="text-[10px] text-slate-600 truncate max-w-[100px]">{l.targetId}</div>}
                          </td>
                          <td className="px-2">
                            {l.metadata ? (
                              <pre className="text-[10px] bg-slate-950/80 border border-slate-800/80 text-emerald-300 p-2 rounded-lg max-w-xs overflow-x-auto whitespace-pre-wrap font-mono">
                                {typeof l.metadata === "string" ? l.metadata : JSON.stringify(l.metadata, null, 2)}
                              </pre>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ONBOARD NEW VENDOR MODAL */}
      {showCreateVendorModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d1117] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 font-mono">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>🏬</span> Onboard New Merchant / Vendor
              </h2>
              <button 
                onClick={() => setShowCreateVendorModal(false)}
                className="text-slate-400 hover:text-white text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createVendorError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg">
                {createVendorError}
              </div>
            )}

            <form onSubmit={handleCreateVendor} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Store / Service Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kololo Gourmet Bistro"
                  value={vendorForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const autoSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    setVendorForm({ ...vendorForm, name, slug: autoSlug });
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">URL Slug</label>
                  <input
                    type="text"
                    required
                    placeholder="kololo-bistro"
                    value={vendorForm.slug}
                    onChange={(e) => setVendorForm({ ...vendorForm, slug: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Owner Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="+256700112233"
                    value={vendorForm.ownerPhone}
                    onChange={(e) => setVendorForm({ ...vendorForm, ownerPhone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Commission Rate (BPS)</label>
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    placeholder="1000 (=10%)"
                    value={vendorForm.commissionBps}
                    onChange={(e) => setVendorForm({ ...vendorForm, commissionBps: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-amber-300 focus:outline-none focus:border-amber-500 font-bold"
                  />
                  <div className="flex gap-1.5 pt-1">
                    {[
                      { bps: "800", label: "8%" },
                      { bps: "1000", label: "10%" },
                      { bps: "1250", label: "12.5%" },
                      { bps: "1500", label: "15%" },
                    ].map((tier) => (
                      <button
                        key={tier.bps}
                        type="button"
                        onClick={() => setVendorForm({ ...vendorForm, commissionBps: tier.bps })}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                          vendorForm.commissionBps === tier.bps
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {tier.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {(Number(vendorForm.commissionBps || 0) / 100).toFixed(2)}% platform take
                  </span>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Slot Order Capacity</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="5"
                    value={vendorForm.defaultSlotCapacity}
                    onChange={(e) => setVendorForm({ ...vendorForm, defaultSlotCapacity: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500">Hourly max delivery slots</span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-slate-400">Kampala Dispatch Hub & Coordinates</label>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {vendorForm.latitude && vendorForm.longitude ? `${vendorForm.latitude}, ${vendorForm.longitude}` : "Pick below"}
                  </span>
                </div>

                {/* Kampala Hub Quick Selector Pills */}
                <div className="grid grid-cols-3 gap-1.5 pb-1">
                  {[
                    { label: "Ntinda / Nakawa", lat: "0.3541", lng: "32.6183" },
                    { label: "Kiwaatule / Naalya", lat: "0.3672", lng: "32.6288" },
                    { label: "Najjera / Kira", lat: "0.3815", lng: "32.6341" },
                    { label: "Bugolobi / Luzira", lat: "0.3162", lng: "32.6267" },
                    { label: "Kololo / Kamwokya", lat: "0.3340", lng: "32.5880" },
                    { label: "Kampala CBD", lat: "0.3136", lng: "32.5811" },
                    { label: "Kansanga / Ggaba", lat: "0.2789", lng: "32.6052" },
                    { label: "Rubaga / Mengo", lat: "0.3012", lng: "32.5534" },
                    { label: "Kawempe / Bwaise", lat: "0.3621", lng: "32.5603" },
                  ].map((hub) => (
                    <button
                      key={hub.label}
                      type="button"
                      onClick={() => setVendorForm({ ...vendorForm, latitude: hub.lat, longitude: hub.lng })}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-mono border transition text-left truncate ${
                        vendorForm.latitude === hub.lat && vendorForm.longitude === hub.lng
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                      }`}
                    >
                      {hub.label}
                    </button>
                  ))}
                </div>

                {/* Fine-grain coordinate inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Latitude (0.347596)"
                    value={vendorForm.latitude}
                    onChange={(e) => setVendorForm({ ...vendorForm, latitude: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-300 font-mono text-[11px]"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Longitude (32.582520)"
                    value={vendorForm.longitude}
                    onChange={(e) => setVendorForm({ ...vendorForm, longitude: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-300 font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowCreateVendorModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createVendorLoading}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-2 cursor-pointer"
                >
                  {createVendorLoading ? 'Registering Store...' : 'Confirm & Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
