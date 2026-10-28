"use client";

import React, { useState, useEffect } from "react";
import VendorLayout from "@/components/vendor/VendorLayout";
import {
  FileSpreadsheet,
  Lock,
  Unlock,
  DollarSign,
  Smartphone,
  CreditCard,
  Printer,
  CheckCircle2,
  AlertTriangle,
  MinusCircle,
  PlusCircle,
  Receipt,
  Clock,
  User,
  ShieldCheck,
  TrendingUp,
  X
} from "lucide-react";

export default function VendorShiftManagementPage() {
  const [activeShift, setActiveShift] = useState<any>(null);
  const [shiftHistory, setShiftHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Modals
  const [isOpenShiftModal, setIsOpenShiftModal] = useState(false);
  const [isCloseShiftModal, setIsCloseShiftModal] = useState(false);
  const [isPaidOutModal, setIsPaidOutModal] = useState(false);
  const [zReportData, setZReportData] = useState<any>(null);

  // Form Fields
  const [cashierName, setCashierName] = useState("John Okello");
  const [openingFloat, setOpeningFloat] = useState("100000");
  const [actualCashCounted, setActualCashCounted] = useState("");
  const [paidOutAmount, setPaidOutAmount] = useState("");
  const [paidOutReason, setPaidOutReason] = useState("");
  const [closingNotes, setClosingNotes] = useState("");

  const loadShifts = async () => {
    setIsLoading(true);
    try {
      const [resActive, resHistory] = await Promise.all([
        fetch("/api/vendor/pos/shift"),
        fetch("/api/vendor/pos/shift?history=true"),
      ]);
      const jsonActive = await resActive.json();
      const jsonHistory = await resHistory.json();

      if (jsonActive.success) setActiveShift(jsonActive.activeShift);
      if (jsonHistory.success) setShiftHistory(jsonHistory.shifts || []);
    } catch {
      setStatusMsg({ text: "Failed to load shift records.", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
  }, []);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/vendor/pos/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open_shift",
          cashierName,
          openingFloat: Number(openingFloat) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      setIsOpenShiftModal(false);
      setStatusMsg({ text: "Shift opened with float UGX " + Number(openingFloat).toLocaleString(), type: "success" });
      loadShifts();
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: "error" });
    }
  };

  const handlePaidOut = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/vendor/pos/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "paid_out",
          paidOutAmount: Number(paidOutAmount) || 0,
          notes: paidOutReason,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      setIsPaidOutModal(false);
      setPaidOutAmount("");
      setPaidOutReason("");
      setStatusMsg({ text: "Paid out recorded.", type: "success" });
      loadShifts();
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: "error" });
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/vendor/pos/shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close_shift",
          actualCashCounted: Number(actualCashCounted) || 0,
          notes: closingNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);

      setIsCloseShiftModal(false);
      setActualCashCounted("");
      setClosingNotes("");
      setZReportData(json.zReport);
      loadShifts();
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: "error" });
    }
  };

  return (
    <VendorLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6 pb-24 font-mono">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              <span>Shift Reconciliation & Z-Reports</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Daily register floats, live cash drawer variance, and financial balancing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!activeShift ? (
              <button
                onClick={() => setIsOpenShiftModal(true)}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white transition flex items-center gap-1.5 shadow-lg shadow-emerald-950"
              >
                <Unlock className="w-4 h-4" />
                <span>Open Shift (Start Float)</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => setIsPaidOutModal(true)}
                  className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-300 transition flex items-center gap-1.5 border border-slate-700"
                >
                  <MinusCircle className="w-4 h-4 text-orange-400" />
                  <span>Paid Out</span>
                </button>
                <button
                  onClick={() => setIsCloseShiftModal(true)}
                  className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white transition flex items-center gap-1.5 shadow-lg shadow-rose-950"
                >
                  <Lock className="w-4 h-4" />
                  <span>Close Shift & Z-Report</span>
                </button>
              </>
            )}
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
            {statusMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Active Shift Live Cockpit */}
        {activeShift ? (
          <div className="bg-[#121620] border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Unlock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>ACTIVE REGISTER SHIFT</span>
                  </div>
                  <div className="text-base font-bold text-white mt-0.5">
                    Cashier: {activeShift.cashierName}
                  </div>
                </div>
              </div>

              <div className="text-right text-xs text-slate-400">
                <div>Opened: {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                <div className="text-[11px] text-slate-500">{new Date(activeShift.openedAt).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <div className="text-slate-500 uppercase font-semibold text-[10px]">Opening Float</div>
                <div className="text-lg font-bold text-white mt-1">
                  UGX {Number(activeShift.openingFloat).toLocaleString()}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <div className="text-slate-500 uppercase font-semibold text-[10px]">Cash Sales (Register)</div>
                <div className="text-lg font-bold text-emerald-400 mt-1">
                  UGX {Number(activeShift.cashSales).toLocaleString()}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <div className="text-slate-500 uppercase font-semibold text-[10px]">MTN MoMo Sales</div>
                <div className="text-lg font-bold text-yellow-400 mt-1">
                  UGX {Number(activeShift.momoSales).toLocaleString()}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <div className="text-slate-500 uppercase font-semibold text-[10px]">Paid Out (Drawn)</div>
                <div className="text-lg font-bold text-rose-400 mt-1">
                  -UGX {Number(activeShift.paidOut).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Expected Cash Drawer Callout */}
            <div className="bg-emerald-950/20 border border-emerald-800/40 p-4 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-[11px] text-emerald-400 uppercase font-bold tracking-wider">
                  Audited Drawer Target (Float + Cash Sales - Paid Out)
                </div>
                <div className="text-2xl font-black text-white mt-0.5">
                  UGX {Number(activeShift.expectedCash).toLocaleString()}
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-400">
                <div>Must match cashier cash count</div>
                <div className="text-emerald-400 font-bold">100% Invariant Checked</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#121620] border border-slate-800 rounded-3xl p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div className="text-white font-bold text-sm">NO ACTIVE SHIFT OPEN</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto font-sans">
              Enter your opening cash float to begin ringing up sales and tracking register balances.
            </p>
            <button
              onClick={() => setIsOpenShiftModal(true)}
              className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white transition shadow-lg shadow-emerald-950 inline-flex items-center gap-1.5"
            >
              <Unlock className="w-4 h-4" />
              <span>Start Shift Float</span>
            </button>
          </div>
        )}

        {/* Section: Past Shift Audit Ledger */}
        <div className="bg-[#121620] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>PAST SHIFT AUDITS & BALANCING LEDGER</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#161a26] text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Shift Window</th>
                  <th className="p-3.5">Cashier</th>
                  <th className="p-3.5">Opening Float</th>
                  <th className="p-3.5">Total Gross</th>
                  <th className="p-3.5">Expected Cash</th>
                  <th className="p-3.5">Actual Counted</th>
                  <th className="p-3.5">Variance</th>
                  <th className="p-3.5 text-right">Z-Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {shiftHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      No closed shifts recorded yet.
                    </td>
                  </tr>
                ) : (
                  shiftHistory.map((s) => {
                    const diff = Number(s.cashDifference) || 0;
                    return (
                      <tr key={s.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-3.5">
                          <div className="font-bold text-white">{new Date(s.closedAt).toLocaleDateString()}</div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(s.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - {new Date(s.closedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-300">{s.cashierName}</td>
                        <td className="p-3.5 text-slate-400">UGX {Number(s.openingFloat).toLocaleString()}</td>
                        <td className="p-3.5 font-bold text-emerald-400">UGX {Number(s.totalSales).toLocaleString()}</td>
                        <td className="p-3.5 text-slate-300">UGX {Number(s.expectedCash).toLocaleString()}</td>
                        <td className="p-3.5 text-white font-bold">UGX {Number(s.actualCashCounted).toLocaleString()}</td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            diff === 0
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : diff > 0
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          }`}>
                            {diff === 0 ? "BALANCED" : `${diff > 0 ? "+" : ""}${diff.toLocaleString()} UGX`}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() =>
                              setZReportData({
                                shiftId: s.id,
                                vendorName: "Store Audit",
                                cashierName: s.cashierName,
                                openedAt: s.openedAt,
                                closedAt: s.closedAt,
                                openingFloat: Number(s.openingFloat),
                                cashSales: Number(s.cashSales),
                                momoSales: Number(s.momoSales),
                                cardSales: Number(s.cardSales),
                                totalSales: Number(s.totalSales),
                                paidOut: Number(s.paidOut),
                                expectedCash: Number(s.expectedCash),
                                actualCashCounted: Number(s.actualCashCounted),
                                difference: diff,
                                status: diff === 0 ? "BALANCED" : diff > 0 ? "OVERAGE" : "SHORTAGE",
                              })
                            }
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                            title="View Z-Report"
                          >
                            <Receipt className="w-3.5 h-3.5" />
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

        {/* MODAL 1: Open Shift Float */}
        {isOpenShiftModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121620] border border-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Unlock className="w-4 h-4 text-emerald-400" />
                  <span>START SHIFT FLOAT</span>
                </div>
                <button onClick={() => setIsOpenShiftModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleOpenShift} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Cashier Name *</label>
                  <input
                    type="text"
                    required
                    value={cashierName}
                    onChange={(e) => setCashierName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Opening Cash Float (Petty Change in Drawer) *</label>
                  <input
                    type="number"
                    required
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-emerald-400 font-bold text-right text-sm"
                  />
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpenShiftModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-950"
                  >
                    Confirm & Open
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: Paid Out (Petty Cash Drawn) */}
        {isPaidOutModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121620] border border-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <MinusCircle className="w-4 h-4 text-orange-400" />
                  <span>RECORD PAID OUT</span>
                </div>
                <button onClick={() => setIsPaidOutModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handlePaidOut} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Amount Drawn (UGX) *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 15000"
                    value={paidOutAmount}
                    onChange={(e) => setPaidOutAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-rose-400 font-bold text-right"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Reason / Expense Receipt *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cooking Gas refill, Receipt #409"
                    value={paidOutReason}
                    onChange={(e) => setPaidOutReason(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPaidOutModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold"
                  >
                    Record Paid Out
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: Close Shift & Actual Cash Count */}
        {isCloseShiftModal && activeShift && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#121620] border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Lock className="w-4 h-4 text-rose-400" />
                  <span>CLOSE SHIFT & COUNT CASH</span>
                </div>
                <button onClick={() => setIsCloseShiftModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-xs space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Opening Float:</span>
                  <span>UGX {Number(activeShift.openingFloat).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>Cash Sales Recorded:</span>
                  <span>+UGX {Number(activeShift.cashSales).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-rose-400">
                  <span>Paid Out Expenses:</span>
                  <span>-UGX {Number(activeShift.paidOut).toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between text-white font-bold">
                  <span>Expected Drawer Cash:</span>
                  <span>UGX {Number(activeShift.expectedCash).toLocaleString()}</span>
                </div>
              </div>

              <form onSubmit={handleCloseShift} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">
                    Actual Physical Cash Counted in Drawer (UGX) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Enter total notes & coins counted"
                    value={actualCashCounted}
                    onChange={(e) => setActualCashCounted(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-bold text-right text-base focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Closing Notes / Discrepancy Reason</label>
                  <textarea
                    rows={2}
                    placeholder="Optional comments for financial auditor..."
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white font-sans"
                  />
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCloseShiftModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg shadow-rose-950"
                  >
                    Seal Shift & Print Z-Report
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 4: Printable Z-Report Dialog */}
        {zReportData && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white text-black rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl font-mono text-xs">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-black text-sm uppercase">END OF SHIFT Z-REPORT</span>
                <button onClick={() => setZReportData(null)} className="text-gray-400 hover:text-black">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center space-y-0.5">
                <div className="font-black text-base">{zReportData.vendorName}</div>
                <div className="text-[10px] text-gray-500">KLARETAIL POS FINANCIAL AUDIT</div>
                <div className="text-[10px] text-gray-500">
                  {new Date(zReportData.closedAt).toLocaleString()}
                </div>
              </div>

              <div className="border-t border-b py-2 space-y-1">
                <div className="flex justify-between">
                  <span>CASHIER:</span>
                  <span className="font-bold">{zReportData.cashierName}</span>
                </div>
                <div className="flex justify-between">
                  <span>SHIFT ID:</span>
                  <span className="text-[10px]">{zReportData.shiftId?.slice(0, 8)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>OPENING FLOAT:</span>
                  <span>UGX {zReportData.openingFloat.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>CASH SALES:</span>
                  <span>UGX {zReportData.cashSales.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>MTN MOMO SALES:</span>
                  <span>UGX {zReportData.momoSales.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>CARD SALES:</span>
                  <span>UGX {zReportData.cardSales.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t pt-1 font-black">
                  <span>GROSS REVENUE:</span>
                  <span>UGX {zReportData.totalSales.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>PAID OUT EXPENSES:</span>
                  <span>-UGX {zReportData.paidOut.toLocaleString()}</span>
                </div>
              </div>

              <div className="border-t border-black pt-2 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>EXPECTED DRAWER CASH:</span>
                  <span>UGX {zReportData.expectedCash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>ACTUAL CASH COUNTED:</span>
                  <span>UGX {zReportData.actualCashCounted.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-black text-sm border-t pt-1">
                  <span>VARIANCE / AUDIT:</span>
                  <span className={zReportData.difference === 0 ? "text-green-600" : "text-red-600"}>
                    {zReportData.status} ({zReportData.difference >= 0 ? "+" : ""}{zReportData.difference.toLocaleString()} UGX)
                  </span>
                </div>
              </div>

              <div className="pt-2 text-center text-[10px] text-gray-500">
                Shift balanced & cryptographically sealed into PostgreSQL ledger.
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <button
                  onClick={() => window.print()}
                  className="w-full py-2 bg-black text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Receipt</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </VendorLayout>
  );
}
