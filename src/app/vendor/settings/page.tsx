"use client";

import React, { useState, useEffect } from "react";
import VendorLayout from "@/components/vendor/VendorLayout";
import {
  Settings,
  Store,
  UtensilsCrossed,
  Save,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Boxes,
  Flame,
  Globe,
  ShieldCheck
} from "lucide-react";

export default function VendorSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sector, setSector] = useState<"food_beverage" | "retail_commerce">("food_beverage");
  const [subCategory, setSubCategory] = useState<"restaurant" | "fast_food" | "retail" | "wholesale">("restaurant");
  const [serviceType, setServiceType] = useState<"quick_service" | "dine_in_hybrid" | "table_service_only">("dine_in_hybrid");
  const [enableTableOrdering, setEnableTableOrdering] = useState(true);
  const [enableQrOrdering, setEnableQrOrdering] = useState(true);
  const [isAcceptingOrders, setIsAcceptingOrders] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/vendor/settings");
        const json = await res.json();
        if (json.success && json.vendor) {
          const v = json.vendor;
          setName(v.name || "");
          setSlug(v.slug || "");
          setSector(v.sector || "food_beverage");
          setSubCategory(v.subCategory || "restaurant");
          setServiceType(v.serviceType || "dine_in_hybrid");
          setEnableTableOrdering(v.enableTableOrdering ?? true);
          setEnableQrOrdering(v.enableQrOrdering ?? true);
          setIsAcceptingOrders(v.isAcceptingOrders ?? true);
        }
      } catch {
        setStatusMsg({ text: "Failed to load store settings.", type: "error" });
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/vendor/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sector,
          subCategory,
          serviceType,
          enableTableOrdering,
          enableQrOrdering,
          isAcceptingOrders,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update settings.");
      }

      setStatusMsg({ text: "Store configuration updated successfully.", type: "success" });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <VendorLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6 pb-24 font-mono">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-400" />
              <span>Store Configuration</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage operational mode, classification, ordering channels, and live status.
            </p>
          </div>

          <div className="text-xs text-slate-500 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
            Slug: <span className="text-white font-bold">@{slug}</span>
          </div>
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

        {isLoading ? (
          <div className="py-20 text-center text-slate-500 text-xs">
            Loading store preferences...
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6 text-xs">
            {/* Store Identity */}
            <div className="bg-[#121620] border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="text-slate-300 font-bold uppercase tracking-wider text-[11px] flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-400" />
                <span>Store Identity</span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Trading Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white font-sans focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">Primary Sector</label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="food_beverage">Food & Beverage</option>
                    <option value="retail_commerce">Retail & Commerce</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Sub-Category</label>
                  <select
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="restaurant">Restaurant (Dine-in / Bistro)</option>
                    <option value="fast_food">Fast Food (Takeaway / Roastery)</option>
                    <option value="retail">Retail (Mart / Supermarket)</option>
                    <option value="wholesale">Wholesale (Bulk / Cartons)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Operational Service Mode */}
            <div className="bg-[#121620] border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="text-slate-300 font-bold uppercase tracking-wider text-[11px] flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <span>Operational Service Mode</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => {
                    setServiceType("dine_in_hybrid");
                    setEnableTableOrdering(true);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    serviceType === "dine_in_hybrid"
                      ? "bg-purple-950/30 border-purple-500 text-purple-200"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="font-bold flex items-center gap-2 mb-1">
                    <UtensilsCrossed className="w-4 h-4 text-purple-400" />
                    <span>Dine-In Hybrid</span>
                  </div>
                  <p className="text-[11px] font-sans text-slate-400 leading-relaxed">
                    Tables T-01 to T-12 enabled on POS register, table QR codes open dine-in menu, kitchen fires directly to KDS.
                  </p>
                </div>

                <div
                  onClick={() => {
                    setServiceType("quick_service");
                    setEnableTableOrdering(false);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition ${
                    serviceType === "quick_service"
                      ? "bg-orange-950/30 border-orange-500 text-orange-200"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <div className="font-bold flex items-center gap-2 mb-1">
                    <Store className="w-4 h-4 text-orange-400" />
                    <span>Fast Food / Counter Service</span>
                  </div>
                  <p className="text-[11px] font-sans text-slate-400 leading-relaxed">
                    Table selection skipped on POS for sub-5-second cashier checkouts; storefront defaults to quick takeaway and bike dispatch.
                  </p>
                </div>
              </div>
            </div>

            {/* Ordering Channel Toggles */}
            <div className="bg-[#121620] border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="text-slate-300 font-bold uppercase tracking-wider text-[11px] flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                <span>Channels & Live Status</span>
              </div>

              <div className="divide-y divide-slate-800/80">
                <div className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">Accepting Orders (Store Open)</div>
                    <div className="text-[11px] text-slate-500 font-sans">
                      When paused, storefront and table QR codes display store as closed.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAcceptingOrders(!isAcceptingOrders)}
                    className="text-slate-300 hover:text-white"
                  >
                    {isAcceptingOrders ? (
                      <ToggleRight className="w-8 h-8 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-600" />
                    )}
                  </button>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">Dine-In Table Ordering</div>
                    <div className="text-[11px] text-slate-500 font-sans">
                      Allow customers scanning table acrylic stands to fire orders directly to kitchen.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableTableOrdering(!enableTableOrdering)}
                    className="text-slate-300 hover:text-white"
                  >
                    {enableTableOrdering ? (
                      <ToggleRight className="w-8 h-8 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-600" />
                    )}
                  </button>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">QR Code Self-Service</div>
                    <div className="text-[11px] text-slate-500 font-sans">
                      Enable takeaway counter stickers and mobile phone checkout.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableQrOrdering(!enableQrOrdering)}
                    className="text-slate-300 hover:text-white"
                  >
                    {enableQrOrdering ? (
                      <ToggleRight className="w-8 h-8 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-600" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-950 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? "Saving..." : "Save Settings"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </VendorLayout>
  );
}
