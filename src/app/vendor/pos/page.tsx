"use client";

import ShiftReconciliation from "@/components/vendor/ShiftReconciliation";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Search, 
  Barcode, 
  Trash2, 
  Plus, 
  Minus, 
  Printer, 
  CheckCircle2, 
  AlertCircle,
  CreditCard,
  Banknote,
  Smartphone,
  UtensilsCrossed,
  Store,
  Settings2,
  ChevronDown
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
  stock?: number;
  category?: string;
}

interface CartItem extends Product {
  quantity: number;
}

export default function AdaptiveVendorPOSPage() {
  const [activeShift, setActiveShift] = useState<any>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([
    { id: "BP-01", name: "BBQ Chicken Pizza (Large)", price: 40000, sku: "PIZ-BBQ-L", barcode: "700101" },
    { id: "BP-02", name: "Meat Lovers Pizza (Mega)", price: 48000, sku: "PIZ-ML-M", barcode: "700102" },
    { id: "BP-03", name: "Margherita Supreme", price: 32000, sku: "PIZ-MARG", barcode: "700103" },
    { id: "BP-04", name: "Hawaiian Tropical", price: 35000, sku: "PIZ-HAW", barcode: "700104" },
    { id: "BP-05", name: "Cheesy Garlic Breadsticks", price: 12000, sku: "SID-GBS", barcode: "700201" },
    { id: "BP-06", name: "Spicy Chicken Wings (6pc)", price: 18000, sku: "SID-WNG", barcode: "700202" },
    { id: "BP-07", name: "Coca-Cola 500ml Pet", price: 2500, sku: "DRK-COKE", barcode: "700301" },
    { id: "BP-08", name: "Mineral Water 1L", price: 2000, sku: "DRK-WTR", barcode: "700302" },
  ]);

  // Operational Mode State
  const [vendorConfig, setVendorConfig] = useState<{
    serviceType: "quick_service" | "dine_in_hybrid" | "table_service_only";
    enableTableOrdering: boolean;
    vendorName: string;
  }>({
    serviceType: "dine_in_hybrid",
    enableTableOrdering: true,
    vendorName: "Bourbon Pizza Wandegeya",
  });

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "momo" | "card">("cash");
  const [cashTendered, setCashTendered] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const barcodeBufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/vendor/settings/service-mode");
        const json = await res.json();
        if (json.success) {
          setVendorConfig({
            serviceType: json.serviceType,
            enableTableOrdering: json.enableTableOrdering,
            vendorName: json.vendorName || "Store POS",
          });
          // In quick service mode, reset table selection
          if (json.serviceType === "quick_service") {
            setSelectedTable(null);
          }
        }
      } catch (e) {
        console.error("Failed to load vendor service settings:", e);
      }
    }
    loadSettings();
  }, []);

  const toggleServiceType = async (type: "quick_service" | "dine_in_hybrid") => {
    try {
      const res = await fetch("/api/vendor/settings/service-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: type,
          enableTableOrdering: type !== "quick_service",
          enableQrOrdering: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setVendorConfig((prev) => ({
          ...prev,
          serviceType: type,
          enableTableOrdering: type !== "quick_service",
        }));
        if (type === "quick_service") setSelectedTable(null);
      }
    } catch (err) {
      alert("Failed to switch service mode.");
    }
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const handleScannedBarcode = useCallback((code: string) => {
    const item = products.find(
      (p) => p.barcode?.toLowerCase() === code.toLowerCase() || p.sku?.toLowerCase() === code.toLowerCase()
    );

    if (item) {
      addToCart(item);
      setStatusMessage({ text: `Scanned: ${item.name}`, type: "success" });
    } else {
      setStatusMessage({ text: `No item found matching: ${code}`, type: "error" });
    }
    setTimeout(() => setStatusMessage(null), 3000);
  }, [products]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTypingField = target.tagName === "INPUT" && target.id !== "barcode-catch";

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      if (e.key === "Enter") {
        if (barcodeBufferRef.current.length >= 3) {
          e.preventDefault();
          const scannedCode = barcodeBufferRef.current.trim();
          handleScannedBarcode(scannedCode);
          barcodeBufferRef.current = "";
        }
        return;
      }

      if (e.key.length === 1) {
        if (timeDiff > 60 && !isTypingField) {
          barcodeBufferRef.current = e.key;
        } else {
          barcodeBufferRef.current += e.key;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleScannedBarcode]);

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setCashTendered("");
    setCustomerPhone("");
  };

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tenderedNum = Number(cashTendered) || 0;
  const changeDue = Math.max(0, tenderedNum - subtotal);

  const handleCheckout = async () => {
    if (cart.length === 0 || isSubmitting) return;

    if (paymentMethod === "cash" && tenderedNum < subtotal) {
      setStatusMessage({ text: "Tendered cash is less than subtotal amount.", type: "error" });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/vendor/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.id,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.price,
          })),
          paymentMethod: paymentMethod === "cash" ? "COD" : paymentMethod === "momo" ? "MTN_MOMO" : "CARD",
          cashTendered: paymentMethod === "cash" ? tenderedNum : subtotal,
          changeDue: paymentMethod === "cash" ? changeDue : 0,
          customerPhone: customerPhone || null,
          tableNumber: selectedTable || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to process sale.");
      }

      setLastReceipt({
        orderNumber: data.order.orderNumber,
        createdAt: new Date().toLocaleTimeString(),
        items: [...cart],
        subtotal,
        paymentMethod,
        cashTendered: tenderedNum,
        changeDue,
        tableNumber: selectedTable,
      });

      clearCart();
      const destination = selectedTable ? `Table ${selectedTable}` : "Takeaway Counter";
      setStatusMessage({ text: `Sale complete (${destination}): ${data.order.orderNumber}`, type: "success" });

      setTimeout(() => {
        window.print();
      }, 300);
    } catch (err: any) {
      setStatusMessage({ text: err.message, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.includes(searchQuery)
  );

  return (
    <div className="flex h-screen w-full bg-[#0b0e14] text-slate-100 font-sans overflow-hidden">
      {/* Product Catalog Canvas */}
      <div className="flex-1 flex flex-col border-r border-slate-800">
        <header className="p-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search product name, SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-sm focus:outline-none focus:border-emerald-500 font-mono text-white placeholder-slate-500"
            />
          </div>

          {/* Quick Mode Switcher for the Owner/Cashier */}
          <div className="flex items-center gap-2">
            <div className="bg-[#121620] border border-slate-800 p-1 rounded-xl flex items-center text-xs font-mono">
              <button
                onClick={() => toggleServiceType("quick_service")}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  vendorConfig.serviceType === "quick_service"
                    ? "bg-amber-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
                title="HungryBox / Food Hub Takeaway Mode"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Fast Takeaway</span>
              </button>
              <button
                onClick={() => toggleServiceType("dine_in_hybrid")}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  vendorConfig.serviceType === "dine_in_hybrid"
                    ? "bg-purple-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Bourbon Pizza Dine-In + Takeaway Mode"
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>Dine-In Hybrid</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-slate-900 px-3 py-2 rounded-xl border border-slate-800">
              <Barcode className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Ready</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="bg-[#12161f] border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 rounded-xl p-3 text-left transition flex flex-col justify-between"
            >
              <div>
                <div className="text-xs font-mono text-slate-500 mb-0.5">{p.sku || "NO-SKU"}</div>
                <div className="font-semibold text-sm text-slate-100 line-clamp-2 leading-snug">
                  {p.name}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/60 font-mono">
                <span className="text-emerald-400 font-bold text-sm">
                  UGX {p.price.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500">{p.stock ? `Qty: ${p.stock}` : "Ready"}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right-Hand Register Panel */}
      <div className="w-[430px] bg-[#0e121a] flex flex-col justify-between border-l border-slate-800/80">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div className="font-mono text-sm font-semibold tracking-wide">
              CURRENT REGISTER <span className="text-slate-500">({cart.length})</span>
            </div>
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-30 transition font-mono"
            >
              Clear Cart
            </button>
          </div>

          {/* Table Ordering Toggle (Only appears if Dine-In is active) */}
          {vendorConfig.enableTableOrdering && (
            <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-slate-800 text-xs font-mono">
              <button
                type="button"
                onClick={() => setSelectedTable(null)}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  !selectedTable ? "bg-emerald-600 text-white font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                Walk-In Takeaway
              </button>
              <button
                type="button"
                onClick={() => setIsTableModalOpen(true)}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  selectedTable ? "bg-purple-600 text-white font-bold" : "text-slate-400 hover:text-white"
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>{selectedTable ? `Table ${selectedTable}` : "Assign Table"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Cart Line Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
              <Store className="w-10 h-10 opacity-30" />
              <div className="text-xs font-mono text-center">
                {vendorConfig.serviceType === "quick_service"
                  ? "Fast-food counter ready. Scan or tap items."
                  : "Tap items or assign table to open dining tab."}
              </div>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="bg-[#151922] border border-slate-800 rounded-lg p-2.5 flex items-center justify-between"
              >
                <div className="flex-1 pr-2 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{item.name}</div>
                  <div className="text-[11px] font-mono text-emerald-400">
                    UGX {item.price.toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-900 border border-slate-700/70 rounded-md">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-1 hover:text-rose-400 transition"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="px-2 text-xs font-mono font-bold">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-1 hover:text-emerald-400 transition"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-slate-500 hover:text-rose-400 transition p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Settle / Payment Controls */}
        <div className="p-4 border-t border-slate-800 bg-[#0b0e14] space-y-3 font-mono">
          {statusMessage && (
            <div
              className={`p-2 rounded-lg text-xs flex items-center gap-2 border ${
                statusMessage.type === "success"
                  ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/50"
                  : "bg-rose-950/40 text-rose-300 border-rose-800/50"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate">{statusMessage.text}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: "cash", label: "Cash", icon: Banknote },
              { id: "momo", label: "MoMo", icon: Smartphone },
              { id: "card", label: "Card", icon: CreditCard },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPaymentMethod(id as any)}
                className={`py-2 flex flex-col items-center justify-center gap-1 rounded-lg border text-xs transition ${
                  paymentMethod === id
                    ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 font-bold"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {paymentMethod === "cash" ? (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Tendered Cash (UGX)</span>
                {changeDue > 0 && (
                  <span className="text-emerald-400 font-bold">Change: UGX {changeDue.toLocaleString()}</span>
                )}
              </div>
              <input
                type="number"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                placeholder={subtotal.toString()}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-right font-mono text-sm focus:outline-none focus:border-emerald-500 text-white"
              />

              <div className="flex gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setCashTendered(subtotal.toString())}
                  className="flex-1 py-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md font-mono border border-slate-700 transition"
                >
                  Exact
                </button>
                {[10000, 20000, 50000, 100000].map((note) => (
                  <button
                    key={note}
                    type="button"
                    onClick={() => setCashTendered(note.toString())}
                    className="flex-1 py-1.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md font-mono border border-slate-700 transition"
                  >
                    {note >= 1000 ? `${note / 1000}k` : note}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-xs text-slate-400">Customer Mobile (Receipt / MoMo)</div>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+2567..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-sm focus:outline-none focus:border-emerald-500 text-white"
              />
            </div>
          )}

          <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Items Subtotal</span>
              <span>UGX {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-white pt-1">
              <span>Total Payable</span>
              <span className="text-emerald-400">UGX {subtotal.toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || isSubmitting}
            className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm tracking-wide transition shadow-lg shadow-emerald-950 flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>
              {isSubmitting
                ? "PROCESSING..."
                : selectedTable
                ? `SETTLE & FIRE TO TABLE ${selectedTable}`
                : "SETTLE & PRINT RECEIPT"}
            </span>
          </button>
        </div>
      </div>

      {/* Table Selector Modal for Dine-In Spots */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-slate-800 rounded-2xl p-5 w-full max-w-md font-mono space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-purple-400" />
                <h3 className="font-bold text-sm text-white">SELECT DINING TABLE</h3>
              </div>
              <button
                onClick={() => setIsTableModalOpen(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {Array.from({ length: 12 }, (_, i) => {
                const tNum = `T-${String(i + 1).padStart(2, "0")}`;
                const isSelected = selectedTable === tNum;
                return (
                  <button
                    key={tNum}
                    onClick={() => {
                      setSelectedTable(tNum);
                      setIsTableModalOpen(false);
                    }}
                    className={`py-3 rounded-xl border text-center transition ${
                      isSelected
                        ? "bg-purple-600 border-purple-500 text-white font-bold shadow-md shadow-purple-950"
                        : "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold">{tNum}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">4 seats</div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between">
              <button
                onClick={() => {
                  setSelectedTable(null);
                  setIsTableModalOpen(false);
                }}
                className="py-2 px-3 rounded-lg bg-slate-800 text-xs text-slate-300 hover:text-white"
              >
                Clear Table Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ESC/POS Thermal Receipt Layout */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #pos-receipt, #pos-receipt * {
            visibility: visible;
          }
          #pos-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 58mm;
            padding: 2mm;
            font-family: monospace;
            font-size: 11px;
            color: black;
            background: white;
          }
        }
      `}</style>

      {lastReceipt && (
        <div id="pos-receipt" className="hidden">
          <div style={{ textAlign: "center", marginBottom: "6px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: "bold", margin: 0 }}>
              {vendorConfig.vendorName.toUpperCase()}
            </h2>
            <p style={{ margin: "2px 0", fontSize: "10px" }}>Kampala, Uganda</p>
            {lastReceipt.tableNumber && (
              <p style={{ margin: "2px 0", fontSize: "11px", fontWeight: "bold" }}>
                TABLE: {lastReceipt.tableNumber}
              </p>
            )}
            <p style={{ margin: "2px 0", fontSize: "9px" }}>Ref: {lastReceipt.orderNumber}</p>
            <p style={{ margin: "2px 0", fontSize: "9px" }}>{lastReceipt.createdAt}</p>
          </div>
          <hr style={{ borderTop: "1px dashed black", margin: "4px 0" }} />
          <div>
            {lastReceipt.items.map((item: any) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", margin: "3px 0" }}>
                <span>{item.quantity}x {item.name.slice(0, 16)}</span>
                <span>{(item.price * item.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <hr style={{ borderTop: "1px dashed black", margin: "4px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
            <span>TOTAL (UGX):</span>
            <span>{lastReceipt.subtotal.toLocaleString()}</span>
          </div>
          {lastReceipt.paymentMethod === "cash" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginTop: "2px" }}>
                <span>CASH TENDERED:</span>
                <span>{lastReceipt.cashTendered.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                <span>CHANGE:</span>
                <span>{lastReceipt.changeDue.toLocaleString()}</span>
              </div>
            </>
          )}
          <div style={{ textAlign: "center", marginTop: "8px", fontSize: "10px" }}>
            <p style={{ margin: 0 }}>Thank you for your visit!</p>
          </div>
        </div>
      )}

      {/* Mandatory Shift Gate Overlay (When no shift is open) */}
      {!activeShift && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-2xl w-full my-8">
            <ShiftReconciliation
              onShiftActive={(s) => setActiveShift(s)}
            />
          </div>
        </div>
      )}

      {/* Manual Shift & Z-Report Ledger Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-3xl w-full my-8 bg-slate-950 p-4 rounded-2xl border border-slate-800 relative">
            <button
              onClick={() => setShowShiftModal(false)}
              className="absolute top-4 right-4 z-10 px-3 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white font-mono text-xs"
            >
              Close Ledger ✕
            </button>
            <ShiftReconciliation
              onShiftActive={(s) => setActiveShift(s)}
            />
          </div>
        </div>
      )}
    </div>
  );
}