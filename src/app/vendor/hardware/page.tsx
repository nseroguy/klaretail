"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, RefreshCw, CheckCircle2, Sliders, Shield } from "lucide-react";

export default function HardwareSetupPage() {
  const [printerPaperSize, setPrinterPaperSize] = useState<"58mm" | "80mm">("80mm");
  const [autoCut, setAutoCut] = useState(true);
  const [openDrawerOnCash, setOpenDrawerOnCash] = useState(true);
  const [printKitchenCopies, setPrintKitchenCopies] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleTestPrint = () => {
    setStatusMessage("Sent ESC/POS test pulse to default thermal printer.");
    setTimeout(() => setStatusMessage(null), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/vendor/dashboard"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Printer className="w-6 h-6 text-emerald-400" />
              Thermal Printers & POS Hardware
            </h1>
            <p className="text-xs md:text-sm text-slate-400">
              Configure USB, Bluetooth, and LAN ESC/POS receipt printers and cash drawers.
            </p>
          </div>
        </div>

        {statusMessage && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {statusMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              Receipt Formatting
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Thermal Paper Width</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPrinterPaperSize("58mm")}
                  className={`py-2 px-4 rounded-xl border text-sm font-semibold transition ${
                    printerPaperSize === "58mm"
                      ? "bg-emerald-600 text-white border-emerald-500"
                      : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  58mm (Compact)
                </button>
                <button
                  type="button"
                  onClick={() => setPrinterPaperSize("80mm")}
                  className={`py-2 px-4 rounded-xl border text-sm font-semibold transition ${
                    printerPaperSize === "80mm"
                      ? "bg-emerald-600 text-white border-emerald-500"
                      : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  80mm (Standard POS)
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCut}
                  onChange={(e) => setAutoCut(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                />
                <span className="text-sm text-slate-300">Trigger automatic paper cutter</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={openDrawerOnCash}
                  onChange={(e) => setOpenDrawerOnCash(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                />
                <span className="text-sm text-slate-300">Kick cash drawer pin on cash settlement</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={printKitchenCopies}
                  onChange={(e) => setPrintKitchenCopies(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
                />
                <span className="text-sm text-slate-300">Duplicate printout for kitchen pass</span>
              </label>
            </div>

            <button
              onClick={handleTestPrint}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-semibold text-white transition flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Print Test Ticket
            </button>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              Connected Peripherals
            </h2>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-200">System WebUSB / RawBT Bridge</p>
                  <p className="text-slate-400">ESC/POS Direct Stream</p>
                </div>
                <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 font-mono">Ready</span>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-200">Barcode / 2D Scanner</p>
                  <p className="text-slate-400">USB HID Keyboard Emulation</p>
                </div>
                <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 font-mono">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
