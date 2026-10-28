"use client";

import React, { useState, useEffect } from "react";

interface Shift {
  id: string;
  cashierName: string;
  openingFloat: number;
  totalGross: number;
  expectedCash: number;
  actualCounted: number;
  variance: number;
  status: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
  zReportNumber: string | null;
}

interface Props {
  onShiftActive?: (shift: Shift | null) => void;
  staffName?: string;
}

export default function ShiftReconciliation({ onShiftActive, staffName }: Props) {
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [pastShifts, setPastShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const [openingFloat, setOpeningFloat] = useState("50000");
  const [cashierInput, setCashierInput] = useState(staffName || "Sarah Namutebi");

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actualCountedInput, setActualCountedInput] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [lastZReport, setLastZReport] = useState<any | null>(null);

  const fetchShiftData = async () => {
    try {
      const res = await fetch("/api/vendor/pos/shift");
      const data = await res.json();
      if (data.success) {
        setActiveShift(data.activeShift);
        setPastShifts(data.pastShifts || []);
        if (onShiftActive) onShiftActive(data.activeShift);
      }
    } catch (e) {
      console.error("Failed to load shift status", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShiftData();
  }, []);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/vendor/pos/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open_shift",
          openingFloat: Number(openingFloat),
          cashierName: cashierInput,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveShift(data.shift);
        if (onShiftActive) onShiftActive(data.shift);
      } else {
        alert(data.message || "Failed to open shift");
      }
    } catch {
      alert("Network error while opening shift");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/vendor/pos/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close_shift",
          actualCounted: Number(actualCountedInput),
          notes: closingNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLastZReport(data.zReport);
        setShowCloseModal(false);
        setActiveShift(null);
        if (onShiftActive) onShiftActive(null);
        fetchShiftData();
      } else {
        alert(data.message || "Failed to close shift");
      }
    } catch {
      alert("Network error while closing shift");
    } finally {
      setLoading(false);
    }
  };

  const formatUGX = (num: number) => `UGX ${(num || 0).toLocaleString()}`;
  const formatDate = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <div className="w-full space-y-6">
      {/* Shift Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Shift Reconciliation &amp; Z-Reports
          </h2>
          <p className="text-xs text-slate-400">
            Daily register floats, live cash drawer variance, and financial balancing.
          </p>
        </div>

        {activeShift ? (
          <div className="flex items-center gap-3">
            <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono">
              <span className="text-slate-400">Cashier:</span>{" "}
              <span className="text-emerald-400 font-bold">{activeShift.cashierName}</span>
              <span className="mx-2 text-slate-700">|</span>
              <span className="text-slate-400">Float:</span>{" "}
              <span className="text-amber-400 font-bold">{formatUGX(activeShift.openingFloat)}</span>
            </div>
            <button
              onClick={() => {
                setActualCountedInput(String(activeShift.expectedCash));
                setShowCloseModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold transition shadow-sm"
            >
              Close Shift &amp; Z-Report
            </button>
          </div>
        ) : (
          <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">
            NO ACTIVE SHIFT
          </span>
        )}
      </div>

      {/* MODAL / SCREEN: When NO Active Shift is Open */}
      {!activeShift && !loading && (
        <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
          <div className="max-w-md mx-auto text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xl">
              💰
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                NO ACTIVE SHIFT OPEN
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter your opening cash float to begin ringing up sales and tracking register balances.
              </p>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-4 pt-2 text-left">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1 uppercase tracking-wider">
                  Cashier Name
                </label>
                <input
                  type="text"
                  value={cashierInput}
                  onChange={(e) => setCashierInput(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-sm font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1 uppercase tracking-wider">
                  Opening Cash Float (UGX)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 font-mono text-sm">UGX</span>
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-14 pr-3.5 py-2.5 text-amber-300 text-sm font-mono font-bold focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[20000, 50000, 75000, 100000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOpeningFloat(String(preset))}
                      className="text-[10px] font-mono px-2 py-1 bg-slate-950 border border-slate-800 text-slate-400 rounded-lg hover:text-white hover:border-slate-700"
                    >
                      {preset / 1000}k
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-sm font-bold transition shadow-lg shadow-emerald-950"
              >
                {loading ? "Starting..." : "Start Shift Float"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reconcile & Close Shift (Z-Report Generation) */}
      {showCloseModal && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Shift Reconciliation &amp; Z-Report</h3>
                <p className="text-xs text-slate-400">Cashier: {activeShift.cashierName}</p>
              </div>
              <button
                onClick={() => setShowCloseModal(false)}
                className="text-slate-500 hover:text-white font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block">Opening Float</span>
                <span className="text-amber-400 font-bold">{formatUGX(activeShift.openingFloat)}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block">Total Sales Gross</span>
                <span className="text-emerald-400 font-bold">{formatUGX(activeShift.totalGross)}</span>
              </div>
              <div className="col-span-2 bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400 font-bold">Expected Drawer Cash:</span>
                <span className="text-white font-bold text-sm">{formatUGX(activeShift.expectedCash)}</span>
              </div>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Actual Counted Cash In Drawer (UGX)
                </label>
                <input
                  type="number"
                  step="500"
                  required
                  value={actualCountedInput}
                  onChange={(e) => setActualCountedInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-base focus:border-rose-500 focus:outline-none"
                />
              </div>

              {/* Live Variance Calculation */}
              {actualCountedInput !== "" && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between font-mono text-xs">
                  <span className="text-slate-400">Cash Drawer Variance:</span>
                  {(() => {
                    const diff = Number(actualCountedInput) - activeShift.expectedCash;
                    if (diff === 0) return <span className="text-emerald-400 font-bold">BALANCED (UGX 0)</span>;
                    if (diff > 0) return <span className="text-cyan-400 font-bold">+ {formatUGX(diff)} (OVER)</span>;
                    return <span className="text-rose-400 font-bold">- {formatUGX(Math.abs(diff))} (SHORT)</span>;
                  })()}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Reconciliation Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UGX 500 coin difference, paid petty cash"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-300 text-xs font-mono focus:border-slate-700 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold transition shadow-lg shadow-rose-950"
                >
                  Generate Z-Report &amp; Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Last Generated Z-Report Summary */}
      {lastZReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
              ✓
            </div>
            <div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                AUDITED Z-REPORT
              </span>
              <h3 className="text-xl font-mono font-extrabold text-white mt-1">
                {lastZReport.number}
              </h3>
              <p className="text-xs text-slate-400">Cashier: {lastZReport.cashier}</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Opening Float:</span>
                <span className="text-white">{formatUGX(lastZReport.openingFloat)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Sales:</span>
                <span className="text-white">{formatUGX(lastZReport.totalGross)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2">
                <span className="text-slate-400 font-bold">Expected Cash:</span>
                <span className="text-amber-300 font-bold">{formatUGX(lastZReport.expectedCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Actual Counted:</span>
                <span className="text-white font-bold">{formatUGX(lastZReport.actualCounted)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2">
                <span className="text-slate-400">Variance:</span>
                <span className={`font-bold ${lastZReport.variance === 0 ? "text-emerald-400" : lastZReport.variance > 0 ? "text-cyan-400" : "text-rose-400"}`}>
                  {lastZReport.variance === 0 ? "0 (BALANCED)" : formatUGX(lastZReport.variance)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setLastZReport(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold"
            >
              Done &amp; Ready for Next Cashier
            </button>
          </div>
        </div>
      )}

      {/* PAST SHIFT AUDITS & BALANCING LEDGER */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
            PAST SHIFT AUDITS &amp; BALANCING LEDGER
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            {pastShifts.length} Archived Shifts
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Shift Window</th>
                <th className="py-3 px-4">Cashier</th>
                <th className="py-3 px-4 text-right">Opening Float</th>
                <th className="py-3 px-4 text-right">Total Gross</th>
                <th className="py-3 px-4 text-right">Expected Cash</th>
                <th className="py-3 px-4 text-right">Actual Counted</th>
                <th className="py-3 px-4 text-center">Variance</th>
                <th className="py-3 px-4 text-center">Z-Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {pastShifts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500 italic">
                    No closed shift reconciliation audits recorded yet.
                  </td>
                </tr>
              ) : (
                pastShifts.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 text-[11px] text-slate-400">
                      {formatDate(s.openedAt)} &rarr; {s.closedAt ? formatDate(s.closedAt).split(" ")[1] : "Active"}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">{s.cashierName}</td>
                    <td className="py-3 px-4 text-right text-amber-300">{formatUGX(s.openingFloat)}</td>
                    <td className="py-3 px-4 text-right text-slate-200">{formatUGX(s.totalGross)}</td>
                    <td className="py-3 px-4 text-right text-slate-300">{formatUGX(s.expectedCash)}</td>
                    <td className="py-3 px-4 text-right text-white font-bold">{formatUGX(s.actualCounted)}</td>
                    <td className="py-3 px-4 text-center">
                      {s.variance === 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          0
                        </span>
                      ) : s.variance > 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                          +{s.variance.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          {s.variance.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-400">
                      {s.zReportNumber || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
