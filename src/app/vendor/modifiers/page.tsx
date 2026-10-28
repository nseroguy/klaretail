"use client";

import React from "react";

export default function VendorModifiersPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto text-slate-100">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Product Modifiers & Add-Ons</h1>
        <p className="text-sm text-slate-400">Manage crust choices, extra toppings, temperature options, and sauces</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="font-semibold mb-2">Pizza Crust Options</h2>
          <div className="text-sm text-slate-400 space-y-1">
            <div className="flex justify-between"><span>Thin & Crispy</span><span>+UGX 0</span></div>
            <div className="flex justify-between"><span>Stuffed Cheese Crust</span><span>+UGX 7,000</span></div>
            <div className="flex justify-between"><span>Gluten-Free Base</span><span>+UGX 5,000</span></div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="font-semibold mb-2">Extra Pizza Toppings</h2>
          <div className="text-sm text-slate-400 space-y-1">
            <div className="flex justify-between"><span>Extra Mozzarella</span><span>+UGX 4,000</span></div>
            <div className="flex justify-between"><span>Beef Pepperoni</span><span>+UGX 6,000</span></div>
            <div className="flex justify-between"><span>Jalapeños</span><span>+UGX 2,500</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
