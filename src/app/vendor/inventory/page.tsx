"use client";

import React from "react";

export default function VendorInventoryPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto text-slate-100">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock & Raw Material Inventory</h1>
          <p className="text-sm text-slate-400">Monitor ingredient levels, low-stock alerts, and batch restocks</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/50 text-slate-400 uppercase text-xs">
            <tr>
              <th className="py-3 px-4">Item</th>
              <th className="py-3 px-4">Current Stock</th>
              <th className="py-3 px-4">Reorder Level</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            <tr>
              <td className="py-3 px-4 font-medium">Mozzarella Cheese</td>
              <td className="py-3 px-4">18.5 kg</td>
              <td className="py-3 px-4">5.0 kg</td>
              <td className="py-3 px-4"><span className="text-emerald-400">In Stock</span></td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium">Pizza Flour (00)</td>
              <td className="py-3 px-4">42.0 kg</td>
              <td className="py-3 px-4">15.0 kg</td>
              <td className="py-3 px-4"><span className="text-emerald-400">In Stock</span></td>
            </tr>
            <tr>
              <td className="py-3 px-4 font-medium">San Marzano Tomatoes</td>
              <td className="py-3 px-4">3.2 kg</td>
              <td className="py-3 px-4">5.0 kg</td>
              <td className="py-3 px-4"><span className="text-amber-400">Low Stock</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
