"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  UtensilsCrossed,
  Flame,
  Store,
  Boxes,
  ShoppingBag,
  Plus,
  Minus,
  CheckCircle2,
  Clock,
  MapPin,
  ChevronRight,
  AlertCircle,
  ArrowLeft
} from "lucide-react";

interface ProductItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  sku?: string;
  isAvailable?: boolean;
}

interface CartItem extends ProductItem {
  quantity: number;
}

export default function UniversalStorefrontPage() {
  const params = useParams();
  // Decode in case the browser passes encoded characters
  const rawParam = params?.slug;
  const slug = typeof rawParam === "string" ? decodeURIComponent(rawParam) : Array.isArray(rawParam) ? rawParam[0] : "";

  const [vendor, setVendor] = useState<any>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderComplete, setOrderComplete] = useState<string | null>(null);

  const defaultItemsBySubCategory: Record<string, ProductItem[]> = {
    fast_food: [
      { id: "FF-1", name: "2pc Crispy Fried Chicken + Chips", price: 22000, description: "Golden fried chicken thighs served with spiced Kampala chips and coleslaw." },
      { id: "FF-2", name: "Full Roasted Chicken", price: 38000, description: "Charcoal-spit roasted chicken seasoned with rosemary and garlic." },
      { id: "FF-3", name: "Spicy Chicken Burger & Fries", price: 25000, description: "Crispy breast fillet, melted cheese, lettuce, house mayo on a toasted brioche." },
      { id: "FF-4", name: "Chilled Soda 500ml", price: 2500, description: "Coca-Cola, Fanta, or Sprite pet bottle." },
    ],
    restaurant: [
      { id: "RES-1", name: "House Special Platter", price: 42000, description: "Charcoal grilled meats with plantain (gonja) and signature salad." },
      { id: "RES-2", name: "Wood-Fired Pizza (Large)", price: 38000, description: "Hand-tossed dough with fresh mozzarella and choice toppings." },
      { id: "RES-3", name: "Garlic Butter Naan / Bread", price: 10000, description: "Freshly pulled tandoor bread brushed with melted herbs." },
    ],
    retail: [
      { id: "RET-1", name: "Fresh Milk 1L Pouch", price: 3000, description: "Pasteurized farm fresh milk." },
      { id: "RET-2", name: "Premium Basmati Rice 5kg", price: 32000, description: "Long grain aromatic rice." },
      { id: "RET-3", name: "Eggs Tray (30pcs)", price: 14000, description: "Farm fresh grade-A eggs." },
    ],
    wholesale: [
      { id: "WS-1", name: "Cooking Oil (Carton of 12 x 1L)", price: 88000, description: "Bulk wholesale carton for retail resale." },
      { id: "WS-2", name: "Sugar Sack (50kg)", price: 210000, description: "Refined white sugar bulk bag." },
      { id: "WS-3", name: "Wheat Flour Carton (10 x 2kg)", price: 65000, description: "Premium baker grade flour carton." },
    ],
  };

  useEffect(() => {
    // Avoid running lookup if slug is empty or literal "[slug]"
    if (!slug || slug === "[slug]") return;

    async function fetchStore() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/store/${encodeURIComponent(slug)}`);
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || "Storefront not found.");
        }
        setVendor(json.vendor);
        if (Array.isArray(json.products) && json.products.length > 0) {
          setProducts(json.products);
        } else {
          const sub = json.vendor.subCategory || "fast_food";
          setProducts(defaultItemsBySubCategory[sub] || defaultItemsBySubCategory.fast_food);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStore();
  }, [slug]);

  const addToCart = (product: ProductItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const subtotal = useMemo(() => {
    return cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }, [cart]);

  if (isLoading || !slug || slug === "[slug]") {
    return (
      <div className="min-h-screen bg-[#0b0e14] text-slate-400 font-mono flex items-center justify-center p-6 text-xs">
        Loading storefront...
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="min-h-screen bg-[#0b0e14] text-slate-100 font-sans flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500" />
        <h2 className="text-xl font-bold font-mono">Store Not Found</h2>
        <p className="text-xs text-slate-400 font-mono max-w-sm">
          No merchant with slug &quot;{slug}&quot; is active on KlaRetail.
        </p>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-mono text-emerald-400 hover:text-white"
        >
          ← Return to Marketplace
        </Link>
      </div>
    );
  }

  const isDineIn = vendor.subCategory === "restaurant" && vendor.enableTableOrdering;

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 font-sans pb-32">
      {/* Top Banner Header */}
      <header className="sticky top-0 z-30 bg-[#121622]/95 backdrop-blur border-b border-slate-800 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              {vendor.name}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {vendor.isAcceptingOrders ? "Open" : "Closed"}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              Kampala • {vendor.subCategory?.replace("_", " ").toUpperCase()}
            </p>
          </div>
        </div>

        {isDineIn && (
          <Link
            href={`/store/${slug}/table/T-01`}
            className="flex items-center gap-1.5 bg-purple-950/60 border border-purple-800/60 px-3 py-1.5 rounded-xl font-mono text-xs font-bold text-purple-300 hover:bg-purple-900/60 transition"
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Dine-In QR Table</span>
          </Link>
        )}
      </header>

      {/* Hero Card */}
      <div className="p-4 max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-slate-900 via-[#141924] to-[#121620] border border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-xs text-emerald-400 font-semibold">
              <MapPin className="w-3.5 h-3.5" />
              <span>Kampala Express Dispatch</span>
            </div>
            <h2 className="text-xl font-black text-white">{vendor.name}</h2>
            <p className="text-xs text-slate-400 font-mono">
              Fast counter pickup, doorstep bike courier, or pay upon delivery.
            </p>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs text-slate-400 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
            <div>
              <span className="text-slate-500 block text-[10px]">PREP & PACK</span>
              <span className="font-bold text-white flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> 15-25m
              </span>
            </div>
            <div className="border-l border-slate-800 pl-3">
              <span className="text-slate-500 block text-[10px]">PAYMENT</span>
              <span className="font-bold text-white">Cash / MoMo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Menu / Catalog Items */}
      <main className="p-4 max-w-4xl mx-auto space-y-3">
        <div className="font-mono text-xs font-bold text-slate-400 tracking-wider uppercase mb-2">
          STORE MENU & PRODUCTS ({products.length})
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {products.map((item) => (
            <div
              key={item.id}
              className="bg-[#131722] border border-slate-800 hover:border-slate-700 transition rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-sm"
            >
              <div>
                <div className="font-bold text-sm text-slate-100">{item.name}</div>
                {item.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed font-sans">
                    {item.description}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 font-mono">
                <span className="text-emerald-400 font-bold text-sm">
                  UGX {item.price.toLocaleString()}
                </span>

                <button
                  onClick={() => addToCart(item)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 inset-x-4 max-w-xl mx-auto z-40">
          <div className="bg-[#141925] border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3 font-mono">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-black font-bold flex items-center justify-center text-xs">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </div>
              <div>
                <div className="text-xs font-bold text-white">UGX {subtotal.toLocaleString()}</div>
                <div className="text-[10px] text-slate-400">{cart.length} unique items in bag</div>
              </div>
            </div>

            <button
              onClick={() => {
                const orderRef = `ORD-${Date.now().toString().slice(-5)}`;
                setOrderComplete(orderRef);
                setCart([]);
              }}
              disabled={isCheckingOut}
              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wider transition shadow-lg shadow-emerald-950 flex items-center gap-1.5"
            >
              <span>CHECKOUT ORDER</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Order Confirmation Modal */}
      {orderComplete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono">
          <div className="bg-[#121620] border border-emerald-500/40 rounded-3xl p-6 w-full max-w-sm text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">ORDER RECEIVED!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Your order is with {vendor.name}. Counter collection / dispatch is starting.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <span className="text-slate-500 block">Reference Code</span>
              <span className="text-base font-bold text-emerald-400">{orderComplete}</span>
            </div>
            <button
              onClick={() => setOrderComplete(null)}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wider transition"
            >
              Done / Order More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
