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
  ShoppingBag
} from "lucide-react";

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
    { id: "all", label: "All Hubs", icon: Sparkles, count: vendorsList.length },
    {
      id: "restaurant",
      label: "Restaurants",
      icon: UtensilsCrossed,
      count: vendorsList.filter((v) => v.subCategory === "restaurant").length,
      desc: "Dine-in & Wood-fired spots",
    },
    {
      id: "fast_food",
      label: "Fast Food",
      icon: Flame,
      count: vendorsList.filter((v) => v.subCategory === "fast_food").length,
      desc: "Quick takeaway & roasteries",
    },
    {
      id: "retail",
      label: "Retail & Groceries",
      icon: Store,
      count: vendorsList.filter((v) => v.subCategory === "retail").length,
      desc: "Supermarkets & marts",
    },
    {
      id: "wholesale",
      label: "Wholesale",
      icon: Boxes,
      count: vendorsList.filter((v) => v.subCategory === "wholesale").length,
      desc: "Bulk cartons & traders",
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
          styles: "bg-purple-950/60 text-purple-300 border-purple-800/60",
          icon: UtensilsCrossed,
        };
      case "fast_food":
        return {
          label: "Fast Food / Counter",
          styles: "bg-orange-950/60 text-orange-300 border-orange-800/60",
          icon: Flame,
        };
      case "retail":
        return {
          label: "Retail Mart",
          styles: "bg-emerald-950/60 text-emerald-300 border-emerald-800/60",
          icon: Store,
        };
      case "wholesale":
        return {
          label: "Wholesale Depot",
          styles: "bg-blue-950/60 text-blue-300 border-blue-800/60",
          icon: Boxes,
        };
      default:
        return {
          label: subCat,
          styles: "bg-slate-800 text-slate-300 border-slate-700",
          icon: ShoppingBag,
        };
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 font-sans pb-20">
      {/* Top Banner Navigation */}
      <header className="sticky top-0 z-30 bg-[#121622]/95 backdrop-blur border-b border-slate-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                KlaRetail Marketplace
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Kampala
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                Order Dine-In, Quick Takeaway, or Bulk Wholesale
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            
            
          </div>
        </div>
      </header>

      {/* Hero Search */}
      <section className="px-6 pt-8 pb-4 max-w-6xl mx-auto">
        <div className="relative max-w-2xl mx-auto text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Discover Stores, Pizzerias & Wholesale Hubs
          </h2>
          <p className="text-sm text-slate-400 font-mono">
            Direct table ordering, counter pick-up, and downtown bulk delivery across Kampala.
          </p>

          <div className="relative pt-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              placeholder="Search vendors (e.g. Bourbon Pizza, Ntinda Roastery, Kiwaatule...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-[#131722] border border-slate-700/80 rounded-2xl text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-lg"
            />
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
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between gap-3 ${
                  isSelected
                    ? "bg-slate-800/90 border-emerald-500/80 shadow-lg shadow-emerald-950/30 text-white"
                    : "bg-[#121620] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      isSelected
                        ? "bg-emerald-500 text-black"
                        : "bg-slate-900 text-slate-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    {cat.count}
                  </span>
                </div>

                <div>
                  <div className="font-bold text-sm text-slate-100">{cat.label}</div>
                  {cat.desc && (
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
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
        <div className="flex items-center justify-between mb-4 font-mono text-xs text-slate-400">
          <div>
            Showing{" "}
            <span className="text-white font-bold">{filteredVendors.length}</span>{" "}
            merchants in{" "}
            <span className="text-emerald-400 uppercase font-semibold">
              {selectedCategory}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-slate-500 font-mono text-sm">
            Loading vendors across Kampala...
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-[#121620] rounded-3xl border border-slate-800 p-8">
            <Store className="w-12 h-12 text-slate-600 mx-auto" />
            <div className="text-base font-bold text-slate-300 font-mono">
              No merchants found in this category
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Try switching category pills or adjusting your search query.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVendors.map((vendor) => {
              const badge = getSubCategoryBadge(vendor.subCategory);
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={vendor.id}
                  className="bg-[#121620] border border-slate-800/90 hover:border-slate-700 transition rounded-3xl p-5 flex flex-col justify-between gap-4 shadow-sm group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-xl border text-[11px] font-mono font-semibold flex items-center gap-1.5 ${badge.styles}`}
                      >
                        <BadgeIcon className="w-3.5 h-3.5" />
                        <span>{badge.label}</span>
                      </span>

                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {vendor.isAcceptingOrders ? "Open" : "Closed"}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition leading-snug">
                        {vendor.name}
                      </h3>
                      <p className="text-xs font-mono text-slate-500 mt-1">
                        @{vendor.slug}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center gap-4 text-xs font-mono text-slate-400">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>Kampala</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>15-30 min</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions / Direct Entry Points */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center gap-2 font-mono text-xs">
                    <Link
                      href={`/store/${vendor.slug}`}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-white font-bold text-center transition flex items-center justify-center gap-1"
                    >
                      <span>Storefront</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </Link>

                    {vendor.enableTableOrdering && (
                      <Link
                        href={`/store/${vendor.slug}/table/T-01`}
                        className="py-2.5 px-3 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/60 text-purple-300 font-bold text-center transition flex items-center gap-1"
                        title="Dine-in Table Menu"
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5" />
                        <span>Table</span>
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
