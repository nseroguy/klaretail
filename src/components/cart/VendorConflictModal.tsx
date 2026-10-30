"use client";

import React from "react";
import { AlertTriangle, Trash2, ArrowRight } from "lucide-react";

interface VendorConflictModalProps {
  isOpen: boolean;
  currentVendorName: string;
  incomingVendorName: string;
  itemCount: number;
  onCancel: () => void;
  onConfirmClearAndAdd: () => void;
}

export default function VendorConflictModal({
  isOpen,
  currentVendorName,
  incomingVendorName,
  itemCount,
  onCancel,
  onConfirmClearAndAdd,
}: VendorConflictModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 overflow-hidden">
        
        {/* Header Icon & Title */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Replace cart contents?
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              Orders can only be placed with one vendor at a time to ensure dedicated dispatch.
            </p>
          </div>
        </div>

        {/* Store Comparison Card */}
        <div className="mt-5 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">Current store:</span>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              {currentVendorName || "Previous Vendor"} ({itemCount} {itemCount === 1 ? "item" : "items"})
            </span>
          </div>

          <div className="flex items-center justify-center text-zinc-400">
            <ArrowRight className="w-4 h-4" />
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">New store:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {incomingVendorName || "New Vendor"}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            Keep Current Cart
          </button>
          
          <button
            type="button"
            onClick={onConfirmClearAndAdd}
            className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear & Add New</span>
          </button>
        </div>

      </div>
    </div>
  );
}
