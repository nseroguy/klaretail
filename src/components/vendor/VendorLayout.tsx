"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard,
  ShoppingCart,
  UtensilsCrossed,
  Package,
  QrCode,
  FileSpreadsheet,
  Settings,
  Store,
  ExternalLink,
  ChevronRight,
  LogOut,
  Flame,
  Boxes,
  Layers,
  Printer,
  ShieldCheck,
  TrendingUp,
  Receipt,
  Users, Wallet, PackageSearch } from "lucide-react";

interface VendorConfig {
  vendorName: string;
  slug: string;
  serviceType: "quick_service" | "dine_in_hybrid" | "table_service_only";
  subCategory: "restaurant" | "fast_food" | "retail" | "wholesale";
  enableTableOrdering: boolean;
  isAcceptingOrders: boolean;
}

interface NavItem {
  label: string;
  href: string;
  icon: any;
  visible?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [userRole, setUserRole] = useState<string>("vendor_owner");

  useEffect(() => {
    try {
      const match = document.cookie.match(/(?:^|;\s*)(?:staff_session|session_token)=([^;]+)/);
      if (match) {
        let dec = match[1];
        while (dec.includes('%')) dec = decodeURIComponent(dec);
        const parsed = JSON.parse(dec);
        if (parsed.role) setUserRole(parsed.role);
      }
    } catch {}
  }, []);
  const [vendor, setVendor] = useState<VendorConfig>({
    vendorName: "Bourbon Pizza Wandegeya",
    slug: "bourbon-pizza-wandegeya",
    serviceType: "dine_in_hybrid",
    subCategory: "restaurant",
    enableTableOrdering: true,
    isAcceptingOrders: true,
  });

  useEffect(() => {
    async function fetchVendorSettings() {
      try {
        const res = await fetch("/api/vendor/settings/service-mode");
        const json = await res.json();
        if (json.success) {
          setVendor({
            vendorName: json.vendorName || "Active Merchant",
            slug: json.slug || "bourbon-pizza-wandegeya",
            serviceType: json.serviceType || "dine_in_hybrid",
            subCategory: json.subCategory || "restaurant",
            enableTableOrdering: json.enableTableOrdering ?? true,
            isAcceptingOrders: true,
          });
        }
      } catch {}
    }
    fetchVendorSettings();
  }, []);

  const navGroups: NavGroup[] = [
    {
      title: "LIVE OPERATIONS",
      items: [
        { label: "Dashboard", href: "/vendor/dashboard", icon: LayoutDashboard },
        { label: "POS Register", href: "/vendor/pos", icon: ShoppingCart },
        { 
          label: "Kitchen KDS", 
          href: "/vendor/kds", 
          icon: Flame, 
          visible: vendor.subCategory === "restaurant" || vendor.subCategory === "fast_food" 
        },
        { label: "Order Dispatch", href: "/vendor/orders", icon: Receipt },
      ],
    },
    {
      title: "CATALOG & MENU",
      items: [
        { label: "Products & Pricing", href: "/vendor/products", icon: Package },
        { 
          label: "Modifier Groups", 
          href: "/vendor/modifiers", 
          icon: Layers, 
          visible: vendor.subCategory === "restaurant" 
        },
        { label: "Inventory Levels", href: "/vendor/inventory", icon: Boxes },
        { 
          label: "Stock Procurement", 
          href: "/vendor/procurement", 
          icon: PackageSearch
        },
      ],
    },
    {
      title: "TABLES & QR SETUP",
      items: [
        { 
          label: "Dining Tables", 
          href: "/vendor/tables", 
          icon: UtensilsCrossed, 
          visible: vendor.enableTableOrdering 
        },
        { label: "QR Stands & Stickers", href: "/vendor/tables/qr", icon: QrCode },
      ],
    },
    {
      title: "AUDIT & BALANCING",
      items: [
        { label: "Shift Balancing (Z-Report)", href: "/vendor/pos/shifts", icon: FileSpreadsheet },
        { label: "Revenue & Tax (VAT)", href: "/vendor/analytics", icon: TrendingUp },
      ],
    },
    {
      title: "SETTINGS & DEVICES",
      items: [
        { label: "Staff & Role Access", href: "/vendor/staff", icon: Users },
        { label: "Store Configuration", href: "/vendor/settings", icon: Settings },
        { label: "Hardware & Printers", href: "/vendor/hardware", icon: Printer },
      ],
    },
  ];

  return (
    <div className="flex h-screen w-full bg-[#0b0e14] text-slate-100 font-sans overflow-hidden">
      {/* Persistent Left Sidebar */}
      <aside className="w-64 bg-[#0e121a] border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Brand & Store Switcher */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center font-black text-emerald-400">
                KR
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs text-white truncate">{vendor.vendorName}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-mono text-slate-400 capitalize">
                    {vendor.serviceType.replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Link to Customer Storefront */}
            <Link
              href={`/store/${vendor.slug}`}
              target="_blank"
              className="mt-3 w-full py-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white flex items-center justify-between font-mono text-[11px] transition"
            >
              <span>View Live Storefront</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar font-mono text-xs">
            {navGroups.map((group) => {
              const visibleItems = group.items.filter((it) => it.visible !== false);
              if (visibleItems.length === 0) return null;

              return (
                <div key={group.title} className="space-y-1">
                  <div className="text-[10px] font-semibold text-slate-500 px-2.5 py-1 tracking-wider uppercase">
                    {group.title}
                  </div>
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-xl transition ${
                          isActive
                            ? "bg-emerald-600/20 text-emerald-300 font-bold border border-emerald-500/30"
                            : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
                          <span>{item.label}</span>
                        </div>
                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer User / Logout */}
          <div className="p-3 border-t border-slate-800 bg-[#0b0e14]/50 font-mono text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-[11px]">
                AO
              </div>
              <div className="text-[11px]">
                <div className="text-white font-medium">Store Admin</div>
                <div className="text-slate-500 text-[9px]">Logged In</div>
              </div>
            </div>
            <Link
              href="/vendor/login"
              className="p-1.5 rounded-lg hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
