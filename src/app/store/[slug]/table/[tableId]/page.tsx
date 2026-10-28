"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  UtensilsCrossed,
  Plus,
  Minus,
  Flame,
  Check,
  X,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface ModifierOption {
  name: string;
  priceDelta: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  category: "pizza" | "sides" | "drinks";
  badge?: string;
  modifierGroups?: ModifierGroup[];
}

interface CartItem {
  cartItemId: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  selectedModifiers: { groupName: string; optionName: string; priceDelta: number }[];
  kitchenNotes?: string;
}

const MENU_ITEMS: MenuItem[] = [
  {
    id: "BP-01",
    name: "BBQ Chicken Pizza",
    description: "Tender grilled chicken chunks, red onions, sweet BBQ swirl, mozzarella.",
    basePrice: 32000,
    category: "pizza",
    badge: "Popular",
    modifierGroups: [
      {
        id: "mg-size",
        name: "Pizza Size",
        isRequired: true,
        minSelections: 1,
        maxSelections: 1,
        options: [
          { name: "Medium 10\"", priceDelta: 0 },
          { name: "Large 12\"", priceDelta: 8000 },
          { name: "Mega 14\"", priceDelta: 15000 },
        ],
      },
      {
        id: "mg-crust",
        name: "Crust Type",
        isRequired: true,
        minSelections: 1,
        maxSelections: 1,
        options: [
          { name: "Classic Pan Crust", priceDelta: 0 },
          { name: "Thin & Crispy", priceDelta: 0 },
          { name: "Cheesy Stuffed Crust", priceDelta: 5000 },
        ],
      },
    ],
  },
  {
    id: "BP-02",
    name: "Meat Lovers Supreme",
    description: "Pepperoni, minced beef, bacon crumbles, spicy sausage, layered mozzarella.",
    basePrice: 35000,
    category: "pizza",
    modifierGroups: [
      {
        id: "mg-size",
        name: "Pizza Size",
        isRequired: true,
        minSelections: 1,
        maxSelections: 1,
        options: [
          { name: "Medium 10\"", priceDelta: 0 },
          { name: "Large 12\"", priceDelta: 8000 },
          { name: "Mega 14\"", priceDelta: 15000 },
        ],
      },
    ],
  },
  {
    id: "BP-05",
    name: "Cheesy Garlic Breadsticks",
    description: "Warm pulled-dough breadsticks brushed with rosemary garlic butter & melted cheese.",
    basePrice: 12000,
    category: "sides",
  },
  {
    id: "BP-06",
    name: "Spicy Peri-Peri Wings (6pc)",
    description: "Flame-glazed crispy chicken wings tossed in Kampala fiery peri-peri.",
    basePrice: 18000,
    category: "sides",
  },
  {
    id: "BP-07",
    name: "Coca-Cola 500ml Pet",
    description: "Chilled classic Coca-Cola.",
    basePrice: 2500,
    category: "drinks",
  },
  {
    id: "BP-08",
    name: "Mineral Water 1L",
    description: "Refreshing cold still water bottle.",
    basePrice: 2000,
    category: "drinks",
  },
];

export default function DynamicCustomerTableOrderPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "bourbon-pizza-wandegeya";
  const rawTableId = (params?.tableId as string) || "T-01";
  const normalizedTable = rawTableId.toUpperCase().startsWith("T-")
    ? rawTableId.toUpperCase()
    : `T-${rawTableId.toUpperCase()}`;

  const formattedStoreName = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const [activeCategory, setActiveCategory] = useState<"all" | "pizza" | "sides" | "drinks">("all");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const [selectedSize, setSelectedSize] = useState<ModifierOption | null>(null);
  const [selectedCrust, setSelectedCrust] = useState<ModifierOption | null>(null);
  const [kitchenNotes, setKitchenNotes] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const openCustomizer = (item: MenuItem) => {
    setSelectedItem(item);
    setQuantity(1);
    setKitchenNotes("");

    const sizeGroup = item.modifierGroups?.find((g) => g.id === "mg-size");
    setSelectedSize(sizeGroup?.options[0] || null);

    const crustGroup = item.modifierGroups?.find((g) => g.id === "mg-crust");
    setSelectedCrust(crustGroup?.options[0] || null);
  };

  const calculatedUnitPrice = useMemo(() => {
    if (!selectedItem) return 0;
    let price = selectedItem.basePrice;
    if (selectedSize) price += selectedSize.priceDelta;
    if (selectedCrust) price += selectedCrust.priceDelta;
    return price;
  }, [selectedItem, selectedSize, selectedCrust]);

  const handleAddCustomizedToCart = () => {
    if (!selectedItem) return;

    const modifiersList: { groupName: string; optionName: string; priceDelta: number }[] = [];
    if (selectedSize) {
      modifiersList.push({
        groupName: "Size",
        optionName: selectedSize.name,
        priceDelta: selectedSize.priceDelta,
      });
    }
    if (selectedCrust) {
      modifiersList.push({
        groupName: "Crust",
        optionName: selectedCrust.name,
        priceDelta: selectedCrust.priceDelta,
      });
    }

    const cartItemId = `${selectedItem.id}-${Date.now()}`;
    setCart((prev) => [
      ...prev,
      {
        cartItemId,
        productId: selectedItem.id,
        name: selectedItem.name,
        unitPrice: calculatedUnitPrice,
        quantity,
        selectedModifiers: modifiersList,
        kitchenNotes: kitchenNotes.trim() || undefined,
      },
    ]);

    setSelectedItem(null);
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  }, [cart]);

  const updateCartQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) => (it.cartItemId === id ? { ...it, quantity: it.quantity + delta } : it))
        .filter((it) => it.quantity > 0)
    );
  };

  const handleSendToKitchen = async () => {
    if (cart.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/store/table-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorSlug: slug,
          tableNumber: normalizedTable,
          items: cart,
          paymentMethod: "COD",
          guestCount: 2,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to submit order to the kitchen.");
      }

      setConfirmedOrderNumber(json.order.orderNumber);
      setCart([]);
      setIsCartOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = MENU_ITEMS.filter((it) => {
    if (activeCategory === "all") return true;
    return it.category === activeCategory;
  });

  return (
    <div className="min-h-screen bg-[#0d1017] text-slate-100 font-sans pb-28">
      {/* Table Banner Header */}
      <header className="sticky top-0 z-30 bg-[#121622]/95 backdrop-blur border-b border-slate-800 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center">
            <Flame className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              {formattedStoreName}
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Open
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Dine-In Digital Menu</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-purple-950/60 border border-purple-800/60 px-3 py-1.5 rounded-xl font-mono text-xs font-bold text-purple-300">
          <UtensilsCrossed className="w-3.5 h-3.5" />
          <span>{normalizedTable}</span>
        </div>
      </header>

      {/* Hero Welcome */}
      <div className="p-4">
        <div className="bg-gradient-to-r from-orange-950/40 via-[#181c26] to-[#121620] border border-orange-500/20 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-orange-400 font-semibold mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ordering to {normalizedTable}</span>
            </div>
            <h2 className="text-base font-bold text-white">{formattedStoreName}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Dispatched directly to the kitchen line.</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-400 text-xl font-bold font-mono">
            🍽️
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar font-mono text-xs">
        {[
          { id: "all", label: "All Items" },
          { id: "pizza", label: "Mains" },
          { id: "sides", label: "Sides" },
          { id: "drinks", label: "Beverages" },
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id as any)}
            className={`px-3.5 py-1.5 rounded-full border transition whitespace-nowrap ${
              activeCategory === cat.id
                ? "bg-orange-600 border-orange-500 text-white font-bold"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Menu Cards */}
      <main className="px-4 py-2 space-y-3">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            onClick={() => openCustomizer(item)}
            className="bg-[#131722] border border-slate-800/80 hover:border-slate-700 active:scale-[0.99] transition rounded-2xl p-3.5 flex justify-between gap-3 cursor-pointer shadow-sm"
          >
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm text-slate-100">{item.name}</h3>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-mono font-bold">
                      {item.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-2.5 flex items-center justify-between font-mono">
                <span className="text-sm font-bold text-orange-400">
                  UGX {item.basePrice.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  Customize <ChevronRight className="w-3 h-3 text-slate-400" />
                </span>
              </div>
            </div>

            <div className="w-20 h-20 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-3xl">
              {item.category === "pizza" ? "🍕" : item.category === "sides" ? "🍗" : "🥤"}
            </div>
          </div>
        ))}
      </main>

      {/* Confirmation Modal */}
      {confirmedOrderNumber && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-emerald-500/40 rounded-3xl p-6 w-full max-w-sm text-center font-mono space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">ORDER IN KITCHEN!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Your ticket has been sent to the kitchen for{" "}
                <span className="text-purple-300 font-bold">{normalizedTable}</span>.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <span className="text-slate-500 block">Order Reference</span>
              <span className="text-base font-bold text-emerald-400">{confirmedOrderNumber}</span>
            </div>
            <button
              onClick={() => setConfirmedOrderNumber(null)}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm tracking-wide transition"
            >
              Done / Order More
            </button>
          </div>
        </div>
      )}

      {/* Customizer Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-[#131722] border-t border-slate-800 rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">{selectedItem.name}</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Base: UGX {selectedItem.basePrice.toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
              {selectedItem.modifierGroups?.find((g) => g.id === "mg-size") && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-2">
                    SELECT SIZE <span className="text-rose-400">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedItem.modifierGroups
                      .find((g) => g.id === "mg-size")
                      ?.options.map((opt) => (
                        <button
                          key={opt.name}
                          type="button"
                          onClick={() => setSelectedSize(opt)}
                          className={`p-2.5 rounded-xl border text-center transition ${
                            selectedSize?.name === opt.name
                              ? "bg-orange-600/20 border-orange-500 text-orange-300 font-bold"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          <div>{opt.name}</div>
                          {opt.priceDelta > 0 && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              +{opt.priceDelta / 1000}k
                            </div>
                          )}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {selectedItem.modifierGroups?.find((g) => g.id === "mg-crust") && (
                <div>
                  <label className="block text-slate-400 font-semibold mb-2">
                    STYLE / CRUST <span className="text-rose-400">*</span>
                  </label>
                  <div className="space-y-1.5">
                    {selectedItem.modifierGroups
                      .find((g) => g.id === "mg-crust")
                      ?.options.map((opt) => (
                        <button
                          key={opt.name}
                          type="button"
                          onClick={() => setSelectedCrust(opt)}
                          className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition ${
                            selectedCrust?.name === opt.name
                              ? "bg-orange-600/20 border-orange-500 text-orange-300 font-bold"
                              : "bg-slate-900 border-slate-800 text-slate-400"
                          }`}
                        >
                          <span>{opt.name}</span>
                          <span>{opt.priceDelta > 0 ? `+UGX ${opt.priceDelta.toLocaleString()}` : "Included"}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  KITCHEN NOTES / CHEF INSTRUCTIONS
                </label>
                <input
                  type="text"
                  placeholder="e.g. Well-done, no onions, extra serviettes..."
                  value={kitchenNotes}
                  onChange={(e) => setKitchenNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-orange-500 text-xs"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <span className="text-slate-300 font-bold">Quantity</span>
                <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-1">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-bold text-sm w-4 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-[#0e121a]">
              <button
                onClick={handleAddCustomizedToCart}
                className="w-full py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 active:scale-[0.99] text-white font-bold text-sm font-mono flex items-center justify-between px-5 shadow-lg shadow-orange-950 transition"
              >
                <span>Add To Table Tab</span>
                <span>UGX {(calculatedUnitPrice * quantity).toLocaleString()}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Bar */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 inset-x-4 z-40">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold font-mono text-sm flex items-center justify-between shadow-xl shadow-orange-950/60 active:scale-[0.99] transition border border-orange-400/30"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-black/30 flex items-center justify-center text-xs">
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </div>
              <span>View Table Tab ({normalizedTable})</span>
            </div>
            <span>UGX {cartTotal.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end">
          <div className="bg-[#131722] border-t border-slate-800 rounded-t-3xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-sm font-mono">TABLE {normalizedTable} TAB</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {cart.map((item) => (
                <div
                  key={item.cartItemId}
                  className="p-3 bg-[#161a25] border border-slate-800 rounded-xl flex items-start justify-between gap-3"
                >
                  <div className="flex-1">
                    <div className="font-bold text-white">{item.name}</div>
                    <div className="text-orange-400 font-semibold mt-0.5">
                      UGX {item.unitPrice.toLocaleString()}
                    </div>

                    {item.selectedModifiers.length > 0 && (
                      <div className="mt-1 space-y-0.5 text-[11px] text-slate-400">
                        {item.selectedModifiers.map((m, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <span className="text-slate-600">•</span>
                            <span>{m.optionName}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {item.kitchenNotes && (
                      <div className="mt-1 text-[10px] text-amber-300 italic">
                        Note: {item.kitchenNotes}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg p-1 shrink-0">
                    <button
                      onClick={() => updateCartQty(item.cartItemId, -1)}
                      className="p-1 hover:text-rose-400"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-4 text-center font-bold text-xs">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQty(item.cartItemId, 1)}
                      className="p-1 hover:text-emerald-400"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-800 bg-[#0e121a] space-y-3 font-mono">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Subtotal</span>
                <span>UGX {cartTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-slate-800">
                <span>Table Total</span>
                <span className="text-orange-400">UGX {cartTotal.toLocaleString()}</span>
              </div>

              <button
                onClick={handleSendToKitchen}
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-950 transition flex items-center justify-center gap-2"
              >
                <Flame className="w-4 h-4 text-orange-300" />
                <span>{isSubmitting ? "SENDING TO KITCHEN..." : "CONFIRM & FIRE ORDER"}</span>
              </button>
              <p className="text-[10px] text-center text-slate-500">
                Payment settles at Table {normalizedTable} after your meal.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
