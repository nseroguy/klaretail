'use client';

import React, { useState, useEffect } from 'react';
import { 
  Package, 
  ShoppingCart, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  ShieldCheck, 
  ChevronRight,
  Boxes
} from 'lucide-react';

interface WholesaleItem {
  tierId: string;
  unitOfMeasure: string;
  minOrderQuantity: number;
  tierPrice: number;
  stockAvailable: number;
  productId: string;
  productName: string;
  wholesalerId: string;
  wholesalerName: string;
  wholesalerSlug: string;
}

interface CartItem extends WholesaleItem {
  orderQuantity: number;
}

interface ActivePO {
  orderNumber: string;
  status: string;
  totalAmount: number;
  handoverPin: string;
  wholesalerName?: string;
  createdAt: string;
}

export default function VendorProcurementPage() {
  const [catalog, setCatalog] = useState<WholesaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [activeTab, setActiveTab] = useState<'catalog' | 'active_pos'>('catalog');
  const [activePOs, setActivePOs] = useState<ActivePO[]>([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [verifyingPin, setVerifyingPin] = useState<string | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load Wholesale Catalog
  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/vendor/b2b/marketplace');
      const data = await res.json();
      if (data.success) {
        setCatalog(data.items || []);
      } else {
        setFeedback({ type: 'error', message: data.message || 'Failed to load catalog.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Network error loading wholesale catalog.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const updateCartQuantity = (item: WholesaleItem, qty: number) => {
    setCart((prev) => {
      const updated = { ...prev };
      if (qty <= 0) {
        delete updated[item.tierId];
      } else {
        updated[item.tierId] = { ...item, orderQuantity: qty };
      }
      return updated;
    });
  };

  const cartList = Object.values(cart);
  const cartSubtotal = cartList.reduce((acc, curr) => acc + curr.tierPrice * curr.orderQuantity, 0);
  const deliveryFee = cartList.length > 0 ? 5000 : 0;
  const cartTotal = cartSubtotal + deliveryFee;

  // Handle PO Creation
  const handlePlaceOrder = async () => {
    if (cartList.length === 0) return;
    setSubmittingOrder(true);
    setFeedback(null);

    const firstItem = cartList[0];
    const payload = {
      wholesalerVendorId: firstItem.wholesalerId,
      deliveryAddress: 'Store Reception / Kitchen Loading Bay',
      items: cartList.map((item) => ({
        productId: item.productId,
        unitOfMeasure: item.unitOfMeasure,
        quantity: item.orderQuantity,
        unitPrice: item.tierPrice,
      })),
    };

    try {
      const res = await fetch('/api/vendor/b2b/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setFeedback({
          type: 'success',
          message: `PO ${data.orderNumber} placed! Escrow hold secured. PIN: ${data.handoverPin}`,
        });
        setActivePOs((prev) => [
          {
            orderNumber: data.orderNumber,
            status: 'SUBMITTED',
            totalAmount: cartTotal,
            handoverPin: data.handoverPin,
            wholesalerName: firstItem.wholesalerName,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        setCart({});
        setActiveTab('active_pos');
      } else {
        setFeedback({ type: 'error', message: data.message });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to communicate with procurement service.' });
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Handle Handover Reception
  const handleVerifyReception = async (orderNumber: string) => {
    if (!enteredPin.trim()) return;
    setVerifyingPin(orderNumber);
    setFeedback(null);

    try {
      const res = await fetch('/api/vendor/b2b/orders/verify-reception', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          handoverPin: enteredPin.trim(),
        }),
      });
      const data = await res.json();

      if (data.success) {
        setFeedback({
          type: 'success',
          message: `PO ${orderNumber} received! Stock inwarded into POS inventory.`,
        });
        setActivePOs((prev) =>
          prev.map((po) =>
            po.orderNumber === orderNumber ? { ...po, status: 'DELIVERED_AND_RECEIVED' } : po
          )
        );
        setEnteredPin('');
      } else {
        setFeedback({ type: 'error', message: data.message });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to verify reception.' });
    } finally {
      setVerifyingPin(null);
    }
  };

  const filteredCatalog = catalog.filter((item) =>
    item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.wholesalerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-8 text-neutral-900">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 font-semibold text-xs tracking-wider uppercase mb-1">
              <Boxes className="w-4 h-4" /> Upstream Supply Chain
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Store Procurement & Wholesale Restock</h1>
            <p className="text-sm text-stone-500">Procure raw stock, ingredients, and bulk inventory with direct wallet escrow settlement.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('catalog')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === 'catalog'
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              Wholesale Catalog ({catalog.length})
            </button>
            <button
              onClick={() => setActiveTab('active_pos')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                activeTab === 'active_pos'
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              <Truck className="w-4 h-4" />
              Active Consignments ({activePOs.length})
            </button>
          </div>
        </div>

        {/* Global Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between text-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-xs font-semibold underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Catalog Tab */}
        {activeTab === 'catalog' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Products List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Search wholesale goods, flour, dairy, packaging..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {loading ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-stone-200 text-stone-400 flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                  <p className="text-sm">Querying Kampala wholesale marketplace...</p>
                </div>
              ) : filteredCatalog.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-stone-200 text-stone-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">No wholesale products available in this category.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredCatalog.map((item) => {
                    const inCart = cart[item.tierId]?.orderQuantity || 0;
                    return (
                      <div
                        key={item.tierId}
                        className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between hover:border-stone-300 transition"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-semibold px-2.5 py-1 bg-stone-100 text-stone-700 rounded-md">
                              {item.unitOfMeasure}
                            </span>
                            <span className="text-xs text-stone-500 font-mono">
                              Stock: {item.stockAvailable} units
                            </span>
                          </div>
                          <h3 className="font-semibold text-stone-900 leading-snug">{item.productName}</h3>
                          <p className="text-xs text-stone-500">Supplier: {item.wholesalerName}</p>
                          <div className="text-lg font-bold text-stone-900 pt-1">
                            UGX {item.tierPrice.toLocaleString()}{' '}
                            <span className="text-xs font-normal text-stone-500">/ unit</span>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-stone-100 mt-4 flex items-center justify-between">
                          {inCart === 0 ? (
                            <button
                              onClick={() => updateCartQuantity(item, item.minOrderQuantity)}
                              className="w-full bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-medium py-2 rounded-xl transition flex items-center justify-center gap-1.5"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              Add to PO
                            </button>
                          ) : (
                            <div className="flex items-center justify-between w-full">
                              <span className="text-xs text-stone-500">Quantity:</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => updateCartQuantity(item, inCart - 1)}
                                  className="w-7 h-7 rounded-lg bg-stone-100 text-stone-700 font-bold flex items-center justify-center hover:bg-stone-200"
                                >
                                  -
                                </button>
                                <span className="font-mono font-semibold text-sm w-6 text-center">
                                  {inCart}
                                </span>
                                <button
                                  onClick={() => updateCartQuantity(item, inCart + 1)}
                                  className="w-7 h-7 rounded-lg bg-stone-100 text-stone-700 font-bold flex items-center justify-center hover:bg-stone-200"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Procurement Order Summary */}
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 font-semibold text-stone-900 border-b border-stone-100 pb-3">
                  <ShoppingCart className="w-4 h-4 text-emerald-600" />
                  <h3>Purchase Order Summary</h3>
                </div>

                {cartList.length === 0 ? (
                  <p className="text-xs text-stone-400 py-6 text-center">
                    Select bulk items from the wholesale catalog to construct a purchase order.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="divide-y divide-stone-100 max-h-60 overflow-y-auto pr-1">
                      {cartList.map((c) => (
                        <div key={c.tierId} className="py-2.5 flex justify-between text-xs">
                          <div>
                            <div className="font-medium text-stone-800">{c.productName}</div>
                            <div className="text-stone-400">
                              {c.orderQuantity} x UGX {c.tierPrice.toLocaleString()} ({c.unitOfMeasure})
                            </div>
                          </div>
                          <div className="font-mono font-semibold text-stone-900">
                            UGX {(c.orderQuantity * c.tierPrice).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-stone-100 pt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between text-stone-500">
                        <span>Items Subtotal</span>
                        <span className="font-mono">UGX {cartSubtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-stone-500">
                        <span>Direct Freight & Delivery</span>
                        <span className="font-mono">UGX {deliveryFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-stone-900 font-bold text-sm pt-2 border-t border-stone-100">
                        <span>Total Escrow Commitment</span>
                        <span className="font-mono text-emerald-600">UGX {cartTotal.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="bg-stone-50 p-3 rounded-xl flex items-start gap-2 text-[11px] text-stone-500 border border-stone-100">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>Funds are held in platform escrow. Payment is released to supplier only after physical reception verification.</span>
                    </div>

                    <button
                      onClick={handlePlaceOrder}
                      disabled={submittingOrder}
                      className="w-full bg-stone-900 text-white font-medium py-3 rounded-xl hover:bg-stone-800 transition text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submittingOrder ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          Issue Purchase Order
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Active POs Tab */}
        {activeTab === 'active_pos' && (
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-stone-900">Pending Consignments & Inward Handshake</h2>
            
            {activePOs.length === 0 ? (
              <p className="text-sm text-stone-400 py-8 text-center">
                No active purchase orders pending handover verification.
              </p>
            ) : (
              <div className="divide-y divide-stone-100">
                {activePOs.map((po) => (
                  <div key={po.orderNumber} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-stone-900">{po.orderNumber}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          po.status === 'DELIVERED_AND_RECEIVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {po.status}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500">
                        Supplier: {po.wholesalerName || 'Wholesale Supplier'} • Escrow: UGX {po.totalAmount.toLocaleString()}
                      </p>
                      <p className="text-xs font-mono text-stone-600">
                        Handover PIN: <span className="font-bold bg-stone-100 px-2 py-0.5 rounded">{po.handoverPin}</span>
                      </p>
                    </div>

                    {po.status !== 'DELIVERED_AND_RECEIVED' && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Enter PIN"
                          maxLength={6}
                          value={enteredPin}
                          onChange={(e) => setEnteredPin(e.target.value)}
                          className="w-28 border border-stone-200 rounded-xl px-3 py-2 text-center text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <button
                          onClick={() => handleVerifyReception(po.orderNumber)}
                          disabled={verifyingPin === po.orderNumber}
                          className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-medium hover:bg-emerald-700 transition flex items-center gap-1.5"
                        >
                          {verifyingPin === po.orderNumber ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          Verify & Inward
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
