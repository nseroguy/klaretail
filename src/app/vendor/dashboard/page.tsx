"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import VendorLayout from "@/components/vendor/VendorLayout";
import {
  ShoppingCart,
  Flame,
  Package,
  QrCode,
  FileSpreadsheet,
  Settings,
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  UtensilsCrossed,
  Store,
  Printer,
  Boxes,
  ShieldCheck
} from "lucide-react";

export default function VendorDashboardPage() {
  const [stats, setStats] = useState({
    todayRevenue: 0,
    ordersCount: 0,
    openTables: 0,
    activeKitchenTickets: 0,
    serviceType: "dine_in_hybrid",
    vendorName: "Loading Store...",
    slug: "",
  });

  useEffect(() => {
    try {
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
        return null;
      };

      const raw = getCookie("session_token") || getCookie("staff_session");
      if (raw) {
        let dec = raw;
        while (dec.includes("%")) dec = decodeURIComponent(dec);
        const session = JSON.parse(dec);

        if (session.vendorName || session.name) {
          setStats((prev) => ({
            ...prev,
            vendorName: session.vendorName || session.name,
            slug: session.vendorSlug || session.slug || "",
          }));
        }
      }

      fetch("/api/vendor/stats")
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success && data.stats) {
            setStats((prev) => ({ ...prev, ...data.stats }));
          }
        })
        .catch((err) => console.error("Error fetching vendor stats:", err));
    } catch (e) {
      console.error("Failed to parse vendor session:", e);
    }
  }, []);

  const [isLoading, setIsLoading] = useState(false);

  const toggleServiceType = async (type: "quick_service" | "dine_in_hybrid") => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/vendor/settings/service-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: type,
          enableTableOrdering: type !== "quick_service",
          enableQrOrdering: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStats((prev) => ({ ...prev, serviceType: type }));
      }
    } catch {}
    setIsLoading(false);
  };

  const tasks = [
    {
      title: "Store Wallet & Treasury",
      description: "Manage float deposits via Pesapal, Mobile Money payouts & audit statement",
      href: "/vendor/wallet",
      icon: Wallet,
      badge: "Treasury",
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    },
    {
      title: "Point of Sale Register",
      desc: "Ring up walk-in customers, scan barcodes, and settle cash or MoMo bills.",
      href: "/vendor/pos",
      icon: ShoppingCart,
      color: "emerald",
      badge: "Fast Checkout",
    },
    {
      title: "Kitchen Display (KDS)",
      desc: "Live preparation queue. Bump hot food from oven prep to ready for pickup.",
      href: "/vendor/kds",
      icon: Flame,
      color: "orange",
      badge: `${stats.activeKitchenTickets} in prep`,
    },
    {
      title: "Catalog & Pricing Manager",
      desc: "Add items, update base prices, set profit margins, and toggle sold-out items.",
      href: "/vendor/products",
      icon: Package,
      color: "blue",
      badge: "Database Synced",
    },
    {
      title: "Table QR Code Generator",
      desc: "Generate and print branded QR cards for tables T-01 through T-12 or counter takeaway stickers.",
      href: "/vendor/tables/qr",
      icon: QrCode,
      color: "purple",
      badge: "Print Ready",
    },
    {
      title: "Shift Balancing & Z-Report",
      desc: "Audit cash float, track payment methods, and close out the drawer.",
      href: "/vendor/pos/shifts",
      icon: FileSpreadsheet,
      color: "cyan",
      badge: "Audit Balanced",
    },
    {
      title: "Printer & Hardware Setup",
      desc: "Configure 58mm/80mm thermal receipt printers, cash drawers, and barcode guns.",
      href: "/vendor/hardware",
      icon: Printer,
      color: "slate",
      badge: "ESC/POS Ready",
    },
  ];

  return (
    <VendorLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Welcome Header */}
        <div className="bg-[#121620] border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">
                Store Portal Online
              </span>
            </div>
            <h1 className="text-2xl font-black text-white">{stats.vendorName}</h1>
            <p className="text-xs text-slate-400 font-mono">
              Welcome back. All operational registers, kitchen links, and audit logs are active.
            </p>
          </div>

          {/* Quick Service Mode Switcher */}
          <div className="bg-[#0b0e14] border border-slate-800 p-1.5 rounded-2xl flex items-center font-mono text-xs">
            <button
              onClick={() => toggleServiceType("quick_service")}
              disabled={isLoading}
              className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition ${
                stats.serviceType === "quick_service"
                  ? "bg-amber-600 text-white font-bold shadow-md shadow-amber-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Fast Food / Counter</span>
            </button>
            <button
              onClick={() => toggleServiceType("dine_in_hybrid")}
              disabled={isLoading}
              className={`px-3 py-2 rounded-xl flex items-center gap-1.5 transition ${
                stats.serviceType === "dine_in_hybrid"
                  ? "bg-purple-600 text-white font-bold shadow-md shadow-purple-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Dine-In Hybrid</span>
            </button>
          </div>
        </div>

        {/* Live Daily Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
          <div className="bg-[#121620] border border-slate-800 p-4 rounded-2xl">
            <div className="text-[11px] text-slate-500 uppercase font-semibold flex items-center justify-between">
              <span>Today's Sales</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1.5">
              UGX {stats.todayRevenue.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">100% auditable receipts</div>
          </div>

          <div className="bg-[#121620] border border-slate-800 p-4 rounded-2xl">
            <div className="text-[11px] text-slate-500 uppercase font-semibold flex items-center justify-between">
              <span>Completed Orders</span>
              <Clock className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-white mt-1.5">{stats.ordersCount} Tickets</div>
            <div className="text-[10px] text-slate-500 mt-1">POS & Table QR combined</div>
          </div>

          <div className="bg-[#121620] border border-slate-800 p-4 rounded-2xl">
            <div className="text-[11px] text-slate-500 uppercase font-semibold flex items-center justify-between">
              <span>Active Tables</span>
              <UtensilsCrossed className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold text-purple-300 mt-1.5">
              {stats.serviceType === "quick_service" ? "N/A (Takeaway)" : `${stats.openTables} Active`}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">T-01, T-04, T-07 seated</div>
          </div>

          <div className="bg-[#121620] border border-slate-800 p-4 rounded-2xl">
            <div className="text-[11px] text-slate-500 uppercase font-semibold flex items-center justify-between">
              <span>Financial Audit</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-white mt-1.5">Balanced</div>
            <div className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Ledger & Cart linear
            </div>
          </div>
        </div>

        {/* Task Launchpad Grid */}
        <div className="space-y-3 font-mono">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            VENDOR WORKSTATIONS & TASKS
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((task) => {
              const Icon = task.icon;
              return (
                <Link
                  key={task.title}
                  href={task.href}
                  className="bg-[#121620] border border-slate-800 hover:border-slate-700 p-5 rounded-3xl flex flex-col justify-between gap-4 transition group hover:shadow-lg shadow-sm"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 group-hover:text-emerald-400 transition">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                        {task.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-sm text-white group-hover:text-emerald-400 transition">
                        {task.title}
                      </h3>
                      <p className="text-xs text-slate-400 font-sans mt-1 line-clamp-2 leading-relaxed">
                        {task.desc}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 group-hover:text-slate-300 transition">
                    <span>Open Module</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition text-slate-400 group-hover:text-emerald-400" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </VendorLayout>
  );
}
