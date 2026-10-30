"use client";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { MarketplaceLogo } from "@/components/brand/MarketplaceLogo";
import VendorConflictModal from "@/components/cart/VendorConflictModal";

import React, { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UtensilsCrossed, Flame, Store, Boxes, ShoppingBag, Plus, Minus, CheckCircle2, Clock, MapPin, ChevronRight, AlertCircle, ArrowLeft, Sparkles, Check, Zap, ArrowRight
} from "lucide-react";

interface ProductItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  sku?: string;
  category?: string;
  imageUrl?: string;
  isAvailable?: boolean;
}

interface CartItem extends ProductItem {
  quantity: number;
}

export default function UniversalStorefrontPage() {
  const params = useParams();
  const router = useRouter();
  // Decode in case the browser passes encoded characters
  const rawParam = params?.slug;
  const slug = typeof rawParam === "string" ? decodeURIComponent(rawParam) : Array.isArray(rawParam) ? rawParam[0] : "";

  const [vendor, setVendor] = useState<any>(null);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictDetails, setConflictDetails] = useState<{
    currentVendorName: string;
    pendingProduct: ProductItem | null;
    itemCount: number;
  }>({
    currentVendorName: "",
    pendingProduct: null,
    itemCount: 0,
  });

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
        // Hydrate cart if stored cart belongs to this specific vendor
        try {
          const raw = localStorage.getItem("klaretail_cart") || localStorage.getItem("cart");
          if (raw) {
            const parsed = JSON.parse(raw);
            const storedVendorId = parsed.vendorId || parsed.vendor?.id;
            if (storedVendorId && json.vendor && storedVendorId === json.vendor.id) {
              const storedItems = Array.isArray(parsed.items) ? parsed.items : [];
              if (storedItems.length > 0) {
                setCart(storedItems.map((it: any) => ({
                  id: it.id || it.productId,
                  name: it.name,
                  price: Number(it.price) || Number(it.unitPrice) || 0,
                  quantity: Number(it.quantity) || 1,
                  weightKg: Number(it.weightKg) || 1.0,
                })));
              }
            }
          }
        } catch {}

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

  const executeAddToCart = (product: ProductItem, baseCart: any[] = cart) => {
    const existing = baseCart.find((i) => i.id === product.id);
    let updatedCart: any[];
    if (existing) {
      updatedCart = baseCart.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      updatedCart = [...baseCart, { ...product, quantity: 1 }];
    }
    setCart(updatedCart);

    // Sync directly to klaretail_cart storage
    const isWholesale = vendor?.subCategory === "wholesale" || vendor?.category === "Wholesale" || updatedCart.some((i: any) => i.moq && i.moq > 1);
    const computedSubtotal = updatedCart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const payload = {
      vendorId: vendor.id,
      vendorName: vendor.name,
      vendorSlug: slug,
      channel: isWholesale ? "wholesale" : "retail",
      items: updatedCart.map(item => ({
        id: item.id,
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        unitPrice: item.price,
        weightKg: (item as any).weightKg || 1.0,
      })),
      subtotal: computedSubtotal,
      deliveryFee: isWholesale ? 15000 : 3000
    };
    localStorage.setItem("klaretail_cart", JSON.stringify(payload));
    localStorage.setItem("cart", JSON.stringify(payload));
  };

  const addToCart = (product: ProductItem) => {
    if (!vendor) return;

    try {
      const raw = localStorage.getItem("klaretail_cart") || localStorage.getItem("cart");
      if (raw) {
        const parsed = JSON.parse(raw);
        const storedVendorId = parsed.vendorId || parsed.vendor?.id;
        const storedItems = Array.isArray(parsed.items) ? parsed.items : [];

        // Vendor conflict detected: cart has items from another store
        if (storedVendorId && storedVendorId !== vendor.id && storedItems.length > 0) {
          const currentCount = storedItems.reduce((acc: number, i: any) => acc + (Number(i.quantity) || 1), 0);
          setConflictDetails({
            currentVendorName: parsed.vendorName || "Another Store",
            pendingProduct: product,
            itemCount: currentCount,
          });
          setConflictModalOpen(true);
          return;
        }
      }
    } catch {}

    executeAddToCart(product);
  };

  const handleConfirmClearAndAdd = () => {
    localStorage.removeItem("klaretail_cart");
    localStorage.removeItem("cart");
    setCart([]);
    if (conflictDetails.pendingProduct) {
      executeAddToCart(conflictDetails.pendingProduct, []);
    }
    setConflictModalOpen(false);
    setConflictDetails({ currentVendorName: "", pendingProduct: null, itemCount: 0 });
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

  // Derive vendor category styling tokens
  const getCategoryTheme = (subCat: string) => {
    switch (subCat) {
      case "wholesale":
        return {
          badge: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-400/30",
          mesh: "from-cyan-600/20 via-blue-600/10 to-transparent",
          accentBorder: "border-cyan-500/20",
          tag: "WHOLESALE HUB",
        };
      case "restaurant":
        return {
          badge: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-400/30",
          mesh: "from-purple-600/20 via-pink-600/10 to-transparent",
          accentBorder: "border-purple-500/20",
          tag: "DINE-IN & RESTAURANT",
        };
      case "fast_food":
        return {
          badge: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-400/30",
          mesh: "from-orange-600/20 via-rose-600/10 to-transparent",
          accentBorder: "border-orange-500/20",
          tag: "EXPRESS FAST FOOD",
        };
      default:
        return {
          badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30",
          mesh: "from-emerald-600/20 via-teal-600/10 to-transparent",
          accentBorder: "border-emerald-500/20",
          tag: "RETAIL & GROCERY",
        };
    }
  };

  const catTheme = getCategoryTheme(vendor.subCategory);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#070b14] text-zinc-900 dark:text-slate-100 font-sans pb-36 relative overflow-hidden transition-colors">
      {/* Top Ambient Glow Mesh */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[340px] bg-gradient-to-b ${catTheme.mesh} blur-[120px] pointer-events-none -z-0`} />

      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#070b14]/85 backdrop-blur-md border-b border-zinc-200/80 dark:border-white/5 px-4 sm:px-6 py-3.5 transition-colors">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2.5 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-slate-300 hover:text-zinc-900 dark:hover:text-white transition shadow-sm active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <MarketplaceLogo size={32} showText={false} className="shrink-0" />
            <div>
              <div className="flex items-center gap-2 leading-none">
                <h1 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white tracking-tight">
                  {vendor.name}
                </h1>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 font-semibold ${
                  vendor.isAcceptingOrders
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                    : "bg-zinc-100 dark:bg-slate-800 text-zinc-500 dark:text-slate-400 border-zinc-200 dark:border-slate-700"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${vendor.isAcceptingOrders ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`} />
                  {vendor.isAcceptingOrders ? "Open" : "Closed"}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-slate-400 font-mono mt-1">
                Kampala • {catTheme.tag}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDineIn && (
              <Link
                href={`/store/${slug}/table/T-01`}
                className="hidden sm:flex items-center gap-1.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 px-3.5 py-2 rounded-2xl font-mono text-xs font-bold text-purple-700 dark:text-purple-300 transition"
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>QR Table Menu</span>
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Vendor Showcase Card */}
      <div className="p-4 sm:p-6 max-w-5xl mx-auto relative z-10">
        <div className="bg-white dark:bg-[#0c101c] border border-zinc-200/90 dark:border-white/10 rounded-[32px] p-6 sm:p-7 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          {/* Subtle Accent Edge Bar */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-orange-400 via-rose-500 to-cyan-400" />

          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-xl border text-[11px] font-mono font-bold flex items-center gap-1.5 ${catTheme.badge}`}>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{catTheme.tag}</span>
              </span>
              <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20">
                <MapPin className="w-3.5 h-3.5" />
                <span>Kampala Dispatch</span>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight pt-1">
              {vendor.name}
            </h2>

            <p className="text-xs sm:text-sm text-zinc-600 dark:text-slate-400 font-mono leading-relaxed">
              Fast counter pickup, express doorstep courier, or pay upon delivery across Greater Kampala.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 p-3.5 rounded-2xl flex-1 md:flex-initial min-w-[120px]">
              <span className="text-zinc-500 dark:text-slate-400 block text-[10px] font-semibold tracking-wider">PREP & PACK</span>
              <span className="font-black text-zinc-900 dark:text-white flex items-center gap-1.5 text-sm mt-0.5">
                <Clock className="w-4 h-4 text-amber-500" /> 15-25m
              </span>
            </div>
            <div className="bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 p-3.5 rounded-2xl flex-1 md:flex-initial min-w-[120px]">
              <span className="text-zinc-500 dark:text-slate-400 block text-[10px] font-semibold tracking-wider">SETTLEMENT</span>
              <span className="font-black text-zinc-900 dark:text-white flex items-center gap-1.5 text-sm mt-0.5">
                <Zap className="w-4 h-4 text-cyan-500" /> Cash / MoMo
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Menu / Catalog Items */}
      <main className="px-4 sm:px-6 max-w-5xl mx-auto space-y-4 relative z-10">
        <div className="flex items-center justify-between font-mono text-xs">
          <div className="font-bold text-zinc-500 dark:text-slate-400 tracking-wider uppercase flex items-center gap-2">
            <span>STORE CATALOG & PRODUCTS</span>
            <span className="px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-slate-300 text-[11px] font-bold">
              {products.length}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
          {products.map((item) => {
            const isWholesale = vendor?.subCategory === "wholesale" || vendor?.category === "Wholesale";
            const customerPrice = isWholesale ? Math.round(item.price * 1.02) : item.price;
            const itemWithCustomerPrice = { 
              ...item, 
              price: customerPrice, 
              vendorPrice: item.price 
            };
            const inCartItem = cart.find((c) => c.id === item.id);
            const inCartQty = inCartItem?.quantity || 0;

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-[#0c101c] border border-zinc-200/90 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 transition-all duration-200 rounded-2xl sm:rounded-[24px] p-3.5 sm:p-5 flex flex-row sm:flex-col justify-between gap-3 sm:gap-4 shadow-sm hover:shadow-lg sm:hover:-translate-y-0.5 group relative overflow-hidden"
              >
                {/* Visual Image / Category Thumbnail Container */}
                <div className="relative w-24 h-24 sm:w-full sm:h-44 sm:aspect-[4/3] rounded-xl sm:rounded-2xl overflow-hidden shrink-0 bg-zinc-100 dark:bg-white/5 order-2 sm:order-1 flex items-center justify-center">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-400 dark:text-slate-500 gap-1.5">
                      {vendor?.subCategory === "restaurant" || vendor?.subCategory === "fast_food" ? (
                        <UtensilsCrossed className="w-7 h-7 sm:w-10 sm:h-10 stroke-[1.5] text-amber-500/60" />
                      ) : (
                        <Boxes className="w-7 h-7 sm:w-10 sm:h-10 stroke-[1.5] text-cyan-500/60" />
                      )}
                      <span className="text-[9px] sm:text-[10px] font-mono tracking-wider uppercase opacity-60">
                        {item.category || "Product"}
                      </span>
                    </div>
                  )}

                  {isWholesale && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-cyan-500/90 text-white backdrop-blur-sm text-[9px] sm:text-[10px] font-mono font-bold tracking-tight shadow-sm">
                      Wholesale
                    </span>
                  )}
                </div>

                {/* Details Section */}
                <div className="flex flex-col justify-between flex-1 min-w-0 order-1 sm:order-2">
                  <div className="space-y-1">
                    <h3 className="font-black text-sm sm:text-base text-zinc-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors leading-snug line-clamp-2">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2.5 sm:pt-3 mt-2 border-t border-zinc-100 dark:border-white/5 font-mono">
                    <div className="flex flex-col">
                      <span className="text-[9px] sm:text-[10px] text-zinc-400 dark:text-slate-500 font-semibold leading-none">UGX</span>
                      <span className="text-xs sm:text-base font-black text-zinc-900 dark:text-white tracking-tight">
                        {customerPrice.toLocaleString()}
                      </span>
                    </div>

                    {/* Interactive Quantity Stepper for Mobile Ergonomics */}
                    {inCartQty > 0 ? (
                      <div className="flex items-center gap-1.5 sm:gap-2 bg-zinc-100 dark:bg-white/10 rounded-xl p-1 border border-zinc-200/80 dark:border-white/10">
                        <button
                          type="button"
                          onClick={() => {
                            if (inCartQty <= 1) {
                              const updated = cart.filter((c) => c.id !== item.id);
                              setCart(updated);
                              localStorage.setItem("klaretail_cart", JSON.stringify({ ...JSON.parse(localStorage.getItem("klaretail_cart") || "{}"), items: updated }));
                            } else {
                              const updated = cart.map((c) => c.id === item.id ? { ...c, quantity: c.quantity - 1 } : c);
                              setCart(updated);
                              localStorage.setItem("klaretail_cart", JSON.stringify({ ...JSON.parse(localStorage.getItem("klaretail_cart") || "{}"), items: updated }));
                            }
                          }}
                          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-zinc-800 dark:text-slate-200 hover:bg-zinc-200 dark:hover:bg-slate-700 active:scale-95 transition shadow-xs text-xs font-bold"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs sm:text-sm font-black min-w-[18px] text-center text-zinc-900 dark:text-white">
                          {inCartQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => addToCart(itemWithCustomerPrice)}
                          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 active:scale-95 transition shadow-xs text-xs font-bold"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addToCart(itemWithCustomerPrice)}
                        className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 active:scale-95 text-white dark:text-zinc-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer min-h-[38px]"
                      >
                        <Plus className="w-3.5 h-3.5 text-cyan-400 dark:text-cyan-600" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-5 inset-x-4 max-w-xl mx-auto z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="backdrop-blur-xl bg-white/95 dark:bg-[#0c101c]/95 border border-zinc-200/90 dark:border-white/15 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3 font-mono">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 text-white font-black flex items-center justify-center text-xs shadow-md">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </div>
              <div>
                <div className="text-xs font-black text-zinc-900 dark:text-white">UGX {subtotal.toLocaleString()}</div>
                <div className="text-[10px] text-zinc-500 dark:text-slate-400">{cart.length} items in bag</div>
              </div>
            </div>

            <button
              onClick={() => {
                if (cart.length === 0) return;
                const isWholesale = vendor?.subCategory === "wholesale" || vendor?.category === "Wholesale" || cart.some((i: any) => i.moq && i.moq > 1);
                const computedSubtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
                
                const checkoutPayload = {
                  vendorId: vendor.id,
                  vendorName: vendor.name,
                  vendorSlug: slug,
                  channel: isWholesale ? "wholesale" : "retail",
                  items: cart.map(item => ({
                    id: item.id,
                    productId: item.id,
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    unitPrice: item.price,
                    vendorPrice: (item as any).vendorPrice || item.price,
                    weightKg: (item as any).weightKg || 1.0,
                  })),
                  subtotal: computedSubtotal,
                  deliveryFee: isWholesale ? 15000 : 3000
                };

                localStorage.setItem("klaretail_cart", JSON.stringify(checkoutPayload));
                localStorage.setItem("cart", JSON.stringify(checkoutPayload));
                router.push(isWholesale ? `/checkout?channel=wholesale&vendor=${slug}` : "/checkout");
              }}
              disabled={isCheckingOut}
              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wider transition shadow-lg shadow-emerald-950 flex items-center gap-1.5 cursor-pointer"
            >
              <span>CHECKOUT ORDER</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Single-Vendor Cart Conflict Modal */}
      <VendorConflictModal
        isOpen={conflictModalOpen}
        currentVendorName={conflictDetails.currentVendorName}
        incomingVendorName={vendor?.name || "Current Store"}
        itemCount={conflictDetails.itemCount}
        onCancel={() => {
          setConflictModalOpen(false);
          setConflictDetails({ currentVendorName: "", pendingProduct: null, itemCount: 0 });
        }}
        onConfirmClearAndAdd={handleConfirmClearAndAdd}
      />

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