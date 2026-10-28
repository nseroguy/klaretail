"use client";

import React, { useState, useEffect } from "react";

export default function VendorTablesPage() {
  const [tables, setTables] = useState([
    { id: 1, number: 1, capacity: 4, status: "available" },
    { id: 2, number: 2, capacity: 2, status: "occupied" },
    { id: 3, number: 3, capacity: 6, status: "available" },
    { id: 4, number: 4, capacity: 4, status: "available" },
  ]);

  return (
    <div className="p-6 max-w-6xl mx-auto text-slate-100">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Table Management & QR Codes</h1>
          <p className="text-sm text-slate-400">Configure dining tables, seating capacity, and QR ordering</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tables.map((t) => (
          <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <span className="text-lg font-bold">Table {t.number}</span>
              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                t.status === "available" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}>
                {t.status}
              </span>
            </div>
            <div className="text-xs text-slate-400 mb-4">{t.capacity} Seats • Dine-In QR Active</div>
            <a
              href={`/store/bourbon-pizza-wandegeya/table/${t.number}`}
              target="_blank"
              rel="noreferrer"
              className="text-center text-xs py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
            >
              Open Table Menu &rarr;
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
