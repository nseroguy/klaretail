"use client";

import React, { useState, useEffect } from "react";
import { Printer, Store, UtensilsCrossed, ExternalLink, Download } from "lucide-react";

export default function VendorQRGeneratorPage() {
  const [vendorSlug, setVendorSlug] = useState("bourbon-pizza-wandegeya");
  const [vendorName, setVendorName] = useState("Bourbon Pizza Wandegeya");
  const [mode, setMode] = useState<"tables" | "storefront">("tables");
  const [host, setHost] = useState("http://localhost:3000");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHost(window.location.origin);
    }
    async function fetchVendor() {
      try {
        const res = await fetch("/api/vendor/settings/service-mode");
        const json = await res.json();
        if (json.success) {
          if (json.slug) setVendorSlug(json.slug);
          if (json.vendorName) setVendorName(json.vendorName);
          if (json.serviceType === "quick_service") setMode("storefront");
        }
      } catch {}
    }
    fetchVendor();
  }, []);

  const getQRUrl = (targetUrl: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(targetUrl)}&margin=10`;
  };

  const storefrontUrl = `${host}/store/${vendorSlug}`;

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 font-sans p-6">
      {/* Control Bar (Hidden when printing) */}
      <div className="max-w-5xl mx-auto mb-8 bg-[#121620] border border-slate-800 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            Branded QR Code Generator
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Printable table cards & takeaway storefront stickers
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[#0b0e14] p-1 rounded-xl border border-slate-800 font-mono text-xs">
            <button
              onClick={() => setMode("tables")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                mode === "tables"
                  ? "bg-purple-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Table Stands (T-01 to T-12)</span>
            </button>
            <button
              onClick={() => setMode("storefront")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                mode === "storefront"
                  ? "bg-amber-600 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Counter / Takeaway Sticker</span>
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold font-mono text-xs flex items-center gap-2 text-white transition shadow-lg shadow-emerald-950"
          >
            <Printer className="w-4 h-4" />
            <span>Print All</span>
          </button>
        </div>
      </div>

      {/* Printable Cards Section */}
      <div className="max-w-5xl mx-auto">
        {mode === "tables" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 12 }, (_, i) => {
              const tableNum = `T-${String(i + 1).padStart(2, "0")}`;
              const targetUrl = `${host}/store/${vendorSlug}/table/${tableNum}`;
              return (
                <div
                  key={tableNum}
                  className="bg-white text-black rounded-3xl p-6 border-4 border-slate-900 shadow-xl flex flex-col items-center text-center page-break-inside-avoid"
                >
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500 font-mono">
                    {vendorName}
                  </div>
                  <div className="my-2 px-4 py-1 rounded-full bg-purple-100 text-purple-900 font-mono font-black text-lg border-2 border-purple-900">
                    TABLE {tableNum}
                  </div>

                  <img
                    src={getQRUrl(targetUrl)}
                    alt={`QR Code for Table ${tableNum}`}
                    className="w-48 h-48 my-3 rounded-xl border border-slate-200"
                  />

                  <div className="font-mono text-xs font-bold text-slate-800">
                    SCAN TO ORDER & VIEW MENU
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
                    No app needed. Orders fire directly to our kitchen oven.
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="bg-white text-black rounded-3xl p-8 border-4 border-slate-900 shadow-2xl flex flex-col items-center text-center max-w-sm page-break-inside-avoid">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 font-mono">
                {vendorName}
              </div>
              <div className="my-3 px-5 py-1.5 rounded-full bg-amber-100 text-amber-900 font-mono font-black text-base border-2 border-amber-900">
                SKIP THE COUNTER QUEUE
              </div>

              <img
                src={getQRUrl(storefrontUrl)}
                alt="Storefront Online Menu QR"
                className="w-56 h-56 my-3 rounded-2xl border border-slate-200"
              />

              <div className="font-mono text-sm font-bold text-slate-900">
                SCAN FOR TAKEAWAY & DELIVERY
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-[240px]">
                Order ahead on your phone or re-order from home anytime.
              </p>
              <div className="mt-4 text-[10px] font-mono text-slate-400 truncate max-w-full">
                {storefrontUrl}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .page-break-inside-avoid {
            page-break-inside: avoid;
            margin-bottom: 20px;
          }
        }
      `}</style>
    </div>
  );
}
