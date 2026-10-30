"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  UtensilsCrossed,
  Flame,
  Store,
  Boxes,
  Search,
  ChevronRight,
  Sparkles,
  MapPin,
  Clock,
  ShoppingBag,
  ShieldCheck,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

type SubCategory = "all" | "restaurant" | "fast_food" | "retail" | "wholesale";

interface VendorSummary {
  id: string;
  name: string;
  slug: string;
  sector: "food_beverage" | "retail_commerce";
  subCategory: "restaurant" | "fast_food" | "retail" | "wholesale";
  serviceType: "quick_service" | "dine_in_hybrid" | "table_service_only";
  enableTableOrdering: boolean;
  enableQrOrdering: boolean;
  isAcceptingOrders: boolean;
}

// Inline Brand Vector Logo derived from master artwork
function MarketPlaceLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="mpBagFront" x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="#00C9FF" />
          <stop offset="35%" stopColor="#144272" />
          <stop offset="75%" stopColor="#0A2647" />
          <stop offset="100%" stopColor="#051923" />
        </linearGradient>
        <linearGradient id="mpBagSide" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF512F" />
          <stop offset="50%" stopColor="#DD2476" />
          <stop offset="100%" stopColor="#2C0C59" />
        </linearGradient>
        <linearGradient id="mpTopGlow" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#FF8A00" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#E52E71" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0A2647" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mpHandleFront" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00F2FE" />
          <stop offset="50%" stopColor="#4FACFE" />
          <stop offset="100%" stopColor="#000DFF" />
        </linearGradient>
        <linearGradient id="mpHandleBack" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFB300" />
          <stop offset="50%" stopColor="#F76B1C" />
          <stop offset="100%" stopColor="#E91E63" />
        </linearGradient>
        <linearGradient id="mpInfLeft" x1="0%" y1="30%" x2="100%" y2="70%">
          <stop offset="0%" stopColor="#00F5D4" />
          <stop offset="45%" stopColor="#00BBF9" />
          <stop offset="85%" stopColor="#4361EE" />
          <stop offset="100%" stopColor="#7209B7" />
        </linearGradient>
        <linearGradient id="mpInfRight" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FEE440" />
          <stop offset="30%" stopColor="#FF7B00" />
          <stop offset="70%" stopColor="#F72585" />
          <stop offset="100%" stopColor="#7209B7" />
        </linearGradient>
        <linearGradient id="mpPin" x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="#FF9E00" />
          <stop offset="50%" stopColor="#FF0054" />
          <stop offset="100%" stopColor="#7209B7" />
        </linearGradient>
      </defs>

      {/* Back Handle */}
      <path
        d="M 230 185 V 135 C 230 90, 310 90, 310 135 V 185"
        fill="none"
        stroke="url(#mpHandleBack)"
        strokeWidth="22"
        strokeLinecap="round"
      />
      {/* Side Panel */}
      <polygon points="325,185 385,185 405,375 325,385" fill="url(#mpBagSide)" />
      {/* Side Mesh Nodes */}
      <g stroke="#ffffff" strokeWidth="2.5" strokeOpacity="0.35" fill="#ffffff">
        <line x1="340" y1="215" x2="368" y2="245" />
        <line x1="368" y1="245" x2="350" y2="295" />
        <circle cx="340" cy="215" r="4.5" fillOpacity="0.8" />
        <circle cx="368" cy="245" r="5" fillOpacity="0.9" />
      </g>
      {/* Pin */}
      <path
        d="M 370 295 C 356 295, 345 306, 345 320 C 345 338, 370 358, 370 358 C 370 358, 395 338, 395 320 C 395 306, 384 295, 370 295 Z"
        fill="url(#mpPin)"
      />
      <circle cx="370" cy="320" r="7.5" fill="#FFEAA7" />
      {/* Front Panel */}
      <polygon points="175,185 330,185 330,385 150,385" fill="url(#mpBagFront)" />
      <polygon points="175,185 330,185 330,305 159,320" fill="url(#mpTopGlow)" />
      {/* Front Handle Mounts & Handle */}
      <circle cx="205" cy="210" r="9" fill="#0A2647" />
      <circle cx="285" cy="210" r="9" fill="#0A2647" />
      <path
        d="M 205 210 V 125 C 205 75, 285 75, 285 125 V 210"
        fill="none"
        stroke="url(#mpHandleFront)"
        strokeWidth="20"
        strokeLinecap="round"
      />
      {/* Infinity + Handshake Emblem */}
      <path
        d="M 240 285 C 215 250, 160 250, 160 285 C 160 320, 215 320, 240 285 Z"
        fill="none"
        stroke="url(#mpInfLeft)"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 240 285 C 265 320, 320 320, 320 285 C 320 250, 265 250, 240 285 Z"
        fill="none"
        stroke="url(#mpInfRight)"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Clasp Details */}
      <g fill="#FFEAA7">
        <rect x="226" y="293" width="16" height="5" rx="2.5" transform="rotate(-30 226 293)" />
        <rect x="232" y="303" width="16" height="5" rx="2.5" transform="rotate(-30 232 303)" />
        <rect x="238" y="313" width="16" height="5" rx="2.5" transform="rotate(-30 238 313)" />
      </g>
      {/* Sparkles */}
      <path
        d="M 148 165 Q 148 177, 136 177 Q 148 177, 148 189 Q 148 177, 160 177 Q 148 177, 148 165 Z"
        fill="#FFD166"
      />
      <circle cx="125" cy="225" r="5" fill="#FF7B00" />
      <path
        d="M 398 238 Q 398 246, 390 246 Q 398 246, 398 254 Q 398 246, 406 246 Q 398 246, 398 238 Z"
        fill="#00F5D4"
      />
      <circle cx="395" cy="180" r="4" fill="#FF512F" />
    </svg>
  );
}

export default function StorefrontHomePage() {
  const [vendorsList, setVendorsList] = useState<VendorSummary[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<SubCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadVendors() {
      try {
        const res = await fetch("/api/vendors");
        const json = await res.json();
        if (json.success && Array.isArray(json.vendors)) {
          setVendorsList(json.vendors);
        }
      } catch (err) {
        console.error("Failed to load storefront vendors:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadVendors();
  }, []);

  const categories = [
    {
      id: "all",
      label: "All Hubs",
      icon: Sparkles,
      count: vendorsList.length,
      gradient: "from-amber-400 to-orange-500",
    },
    {
      id: "restaurant",
      label: "Restaurants",
      icon: UtensilsCrossed,
      count: vendorsList.filter((v) => v.subCategory === "restaurant").length,
      desc: "Dine-in & Wood-fired spots",
      gradient: "from-purple-500 to-pink-500",
    },
    {
      id: "fast_food",
      label: "Fast Food",
      icon: Flame,
      count: vendorsList.filter((v) => v.subCategory === "fast_food").length,
      desc: "Quick takeaway & roasteries",
      gradient: "from-orange-500 to-red-500",
    },
    {
      id: "retail",
      label: "Retail & Groceries",
      icon: Store,
      count: vendorsList.filter((v) => v.subCategory === "retail").length,
      desc: "Supermarkets & marts",
      gradient: "from-emerald-400 to-teal-500",
    },
    {
      id: "wholesale",
      label: "Wholesale",
      icon: Boxes,
      count: vendorsList.filter((v) => v.subCategory === "wholesale").length,
      desc: "Bulk cartons & traders",
      gradient: "from-cyan-400 to-blue-600",
    },
  ];

  const filteredVendors = useMemo(() => {
    return vendorsList.filter((v) => {
      const matchesCategory =
        selectedCategory === "all" || v.subCategory === selectedCategory;
      const matchesSearch =
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.slug.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [vendorsList, selectedCategory, searchQuery]);

  const getSubCategoryBadge = (subCat: string) => {
    switch (subCat) {
      case "restaurant":
        return {
          label: "Restaurant / Dine-In",
          styles: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-400/30",
          glow: "hover:border-purple-500/40 hover:shadow-purple-500/10",
          accentLine: "from-purple-500 to-pink-500",
          icon: UtensilsCrossed,
          headerGradients: "from-purple-500/25 via-pink-500/10 to-transparent",
        };
      case "fast_food":
        return {
          label: "Fast Food / Counter",
          styles: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-400/30",
          glow: "hover:border-orange-500/40 hover:shadow-orange-500/10",
          accentLine: "from-orange-500 to-rose-500",
          icon: Flame,
          headerGradients: "from-orange-500/25 via-rose-500/10 to-transparent",
        };
      case "retail":
        return {
          label: "Retail Mart",
          styles: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30",
          glow: "hover:border-emerald-500/40 hover:shadow-emerald-500/10",
          accentLine: "from-emerald-400 to-teal-500",
          icon: Store,
          headerGradients: "from-emerald-500/25 via-teal-500/10 to-transparent",
        };
      case "wholesale":
        return {
          label: "Wholesale Depot",
          styles: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-400/30",
          glow: "hover:border-cyan-500/40 hover:shadow-cyan-500/10",
          accentLine: "from-cyan-400 to-blue-600",
          icon: Boxes,
          headerGradients: "from-cyan-500/25 via-blue-500/10 to-transparent",
        };
      default:
        return {
          label: subCat,
          styles: "bg-zinc-500/15 text-zinc-700 dark:text-slate-300 border-zinc-400/30",
          glow: "hover:border-zinc-400/40 hover:shadow-zinc-500/10",
          accentLine: "from-slate-400 to-slate-600",
          icon: ShoppingBag,
          headerGradients: "from-slate-500/20 via-slate-600/5 to-transparent",
        };
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#070b14] text-zinc-900 dark:text-slate-100 font-sans pb-24 relative overflow-hidden transition-colors">
      {/* Ambient Radial Mesh Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[360px] bg-gradient-to-tr from-cyan-600/15 via-rose-500/15 to-amber-500/10 blur-[130px] pointer-events-none -z-10" />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-[#070b14]/85 backdrop-blur-md border-b border-zinc-200 dark:border-white/5 px-6 py-3.5 transition-colors">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3.5 group">
            <div className="relative flex items-center justify-center p-1 rounded-2xl bg-gradient-to-b from-zinc-200/50 dark:from-white/10 to-transparent border border-zinc-300 dark:border-white/10 shadow-lg group-hover:scale-105 transition duration-300">
              <MarketPlaceLogo className="w-9 h-9" />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-1.5 leading-none">
                <span>the</span>
                <span className="bg-gradient-to-r from-orange-500 via-pink-500 to-cyan-500 bg-clip-text text-transparent">
                  market
                </span>
                <span>place</span>
                <span className="ml-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800/50">
                  Kampala
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-slate-400 font-mono mt-1">
                Connected Trade & Dine-in Ecosystem
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-zinc-600 dark:text-slate-400 bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 px-3 py-1.5 rounded-full">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Verified Commerce</span>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Visual Section */}
      <section className="px-6 pt-10 pb-6 max-w-6xl mx-auto">
        <div className="relative max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-orange-500/10 via-rose-500/10 to-cyan-500/10 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-700 dark:text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
            <span>Discover local stores, verified pizzerias & wholesale hubs</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-zinc-900 dark:text-white tracking-tight leading-[1.1]">
            Everything you crave & need,{" "}
            <span className="bg-gradient-to-r from-orange-500 via-rose-500 to-cyan-500 bg-clip-text text-transparent">
              all in one place.
            </span>
          </h2>

          <p className="text-sm sm:text-base text-zinc-600 dark:text-slate-400 font-mono max-w-xl mx-auto">
            Direct contactless table ordering, rapid express pick-up, and downtown wholesale delivery across Kampala.
          </p>

          {/* Search Box with Brand Glow */}
          <div className="relative pt-4 max-w-2xl mx-auto">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 via-rose-500 to-cyan-500 rounded-3xl blur opacity-25 dark:opacity-30 transition duration-500" />
            <div className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-zinc-400 dark:text-slate-400" />
              <input
                type="text"
                placeholder="Search vendors (e.g. Bourbon Pizza, Ntinda Roastery, Kiwaatule Wholesale...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-[#0e1321] border border-zinc-200 dark:border-white/15 rounded-2xl text-sm font-mono text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 transition shadow-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Primary Category Tabs */}
      <section className="px-6 py-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 font-mono text-xs">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id as SubCategory)}
                className={`p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between gap-3 relative overflow-hidden group ${
                  isSelected
                    ? "bg-white dark:bg-[#13192b] border-cyan-500/80 shadow-lg shadow-cyan-950/20 text-zinc-900 dark:text-white"
                    : "bg-white/80 dark:bg-[#0d121f] border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-slate-400 hover:border-zinc-300 dark:hover:border-white/20 hover:text-zinc-900 dark:hover:text-slate-200"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-orange-400 via-rose-500 to-cyan-400" />
                )}

                <div className="flex items-center justify-between w-full">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                      isSelected
                        ? "bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-md shadow-orange-950/40"
                        : "bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-slate-300 group-hover:bg-zinc-200 dark:group-hover:bg-white/10"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-bold text-zinc-500 dark:text-slate-400 bg-zinc-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                    {cat.count}
                  </span>
                </div>

                <div>
                  <div className="font-bold text-sm text-zinc-900 dark:text-slate-100">{cat.label}</div>
                  {cat.desc && (
                    <div className="text-[10px] text-zinc-500 dark:text-slate-400 truncate mt-0.5">
                      {cat.desc}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Vendors Catalog Grid */}
      <main className="px-6 py-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-5 font-mono text-xs text-zinc-600 dark:text-slate-400">
          <div>
            Showing{" "}
            <span className="text-zinc-900 dark:text-white font-bold">{filteredVendors.length}</span>{" "}
            verified partners in{" "}
            <span className="text-cyan-600 dark:text-cyan-400 uppercase font-semibold">
              {selectedCategory}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-24 text-center text-zinc-500 dark:text-slate-400 font-mono text-sm animate-pulse">
            Connecting to Kampala storefront network...
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-white dark:bg-[#0d121f] rounded-3xl border border-zinc-200 dark:border-white/5 p-8 max-w-md mx-auto shadow-sm">
            <MarketPlaceLogo className="w-14 h-14 mx-auto opacity-40 grayscale" />
            <div className="text-base font-bold text-zinc-800 dark:text-slate-200 font-mono">
              No merchants found
            </div>
            <p className="text-xs text-zinc-500 dark:text-slate-400 font-mono">
              Try adjusting your search criteria or switching to All Hubs.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredVendors.map((vendor) => {
              const badge = getSubCategoryBadge(vendor.subCategory);
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={vendor.id}
                  className={`bg-white dark:bg-[#0c101c] border border-zinc-200/90 dark:border-white/10 ${badge.glow} hover:-translate-y-1.5 transition-all duration-300 rounded-[28px] p-6 flex flex-col justify-between gap-5 shadow-sm hover:shadow-2xl group relative overflow-hidden`}
                >
                  {/* Top Category Vibrant Accent Bar */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r ${badge.accentLine}`}
                  />

                  {/* Ambient Header Color Spill */}
                  <div
                    className={`absolute -top-10 -right-10 w-44 h-32 bg-gradient-to-br ${badge.headerGradients} blur-2xl pointer-events-none -z-0 group-hover:scale-125 transition-transform duration-500`}
                  />

                  <div className="space-y-4 relative z-10">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-2 shadow-sm ${badge.styles}`}
                      >
                        <BadgeIcon className="w-4 h-4" />
                        <span>{badge.label}</span>
                      </span>

                      <span
                        className={`text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                          vendor.isAcceptingOrders
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : "bg-zinc-100 dark:bg-slate-800 text-zinc-500 dark:text-slate-400 border-zinc-200 dark:border-slate-700"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            vendor.isAcceptingOrders
                              ? "bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"
                              : "bg-zinc-400 dark:bg-slate-500"
                          }`}
                        />
                        {vendor.isAcceptingOrders ? "Open" : "Closed"}
                      </span>
                    </div>

                    <div className="pt-1">
                      <h3 className="text-xl font-black text-zinc-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors tracking-tight leading-tight">
                        {vendor.name}
                      </h3>
                      <p className="text-xs font-mono text-zinc-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                        <span className="text-orange-500 font-bold">@</span>{vendor.slug}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between text-xs font-mono text-zinc-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <div className="p-1 rounded-md bg-rose-500/10 text-rose-500">
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-medium">Kampala Central</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="p-1 rounded-md bg-amber-500/10 text-amber-500">
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-semibold text-zinc-800 dark:text-slate-200">15-30m</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Direct Entry Points */}
                  <div className="pt-3 border-t border-zinc-100 dark:border-white/5 flex items-center gap-2.5 font-mono text-xs relative z-10">
                    <Link
                      href={`/store/${vendor.slug}`}
                      className="flex-1 py-3 px-4 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-black text-center transition-all duration-200 flex items-center justify-center gap-2 hover:opacity-90 shadow-md group-hover:shadow-lg"
                    >
                      <span>Explore Store</span>
                      <ChevronRight className="w-4 h-4 text-cyan-400 dark:text-cyan-600 group-hover:translate-x-1 transition-transform" />
                    </Link>

                    {vendor.enableTableOrdering && (
                      <Link
                        href={`/store/${vendor.slug}/table/T-01`}
                        className="py-3 px-3.5 rounded-2xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-700 dark:text-purple-300 font-bold text-center transition flex items-center gap-1.5"
                        title="Dine-in Table Menu"
                      >
                        <UtensilsCrossed className="w-4 h-4" />
                        <span>Dine-In</span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
