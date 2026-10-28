"use client";

import React from "react";

export default function VendorAnalyticsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto text-slate-100">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Sales & Revenue Analytics</h1>
        <p className="text-sm text-slate-400">Track hourly gross volume, average basket size, and popular menu items</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase font-semibold">Today's Gross Sales</div>
          <div className="text-2xl font-bold mt-1 text-emerald-400">UGX 482,000</div>
          <div className="text-xs text-slate-400 mt-1">14 completed orders</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase font-semibold">Average Ticket Value</div>
          <div className="text-2xl font-bold mt-1">UGX 34,428</div>
          <div className="text-xs text-slate-400 mt-1">Dine-in & counter pick-up</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase font-semibold">Top Selling Category</div>
          <div className="text-2xl font-bold mt-1 text-amber-400">Pizzas (68%)</div>
          <div className="text-xs text-slate-400 mt-1">BBQ Chicken & Margherita</div>
        </div>
      </div>
    </div>
  );
}
