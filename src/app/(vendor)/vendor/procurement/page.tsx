'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface WholesaleTierItem {
  id: string;
  productId: string;
  name: string;
  category: string;
  wholesalerId: string;
  wholesalerName: string;
  unitOfMeasure: string;
  minOrderQuantity: number;
  tierPrice: number;
  stockUnitsAvailable: number;
  imageUrl?: string;
}

interface CartItem extends WholesaleTierItem {
  orderQuantity: number;
}

interface ActivePO {
  orderNumber: string;
  status: string;
  totalAmount: number;
  paymentTerms?: string;
  handoverPin: string;
  wholesalerName: string;
  createdAt: string;
}

interface CreditFacility {
  creditLimit: number;
  availableCredit: number;
  drawnAmount: number;
  interestRateBps: number;
  maxTenorDays: number;
  status: string;
}

export default function VendorProcurementPage() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'active_pos'>('catalog');
  const [items, setItems] = useState<WholesaleTierItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [activePOs, setActivePOs] = useState<ActivePO[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fintech / SNPL States
  const [paymentMethod, setPaymentMethod] = useState<'credit_financing' | 'PREPAID_WALLET'>('credit_financing');
  const [creditFacility, setCreditFacility] = useState<CreditFacility | null>(null);
  const [loadingCredit, setLoadingCredit] = useState(true);

  // 1. Fetch Wholesale Catalog & Active POs
  useEffect(() => {
    async function loadCatalogData() {
      try {
        const res = await fetch('/api/vendor/b2b/catalog', { credentials: 'include' });
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          setItems(data.items);
        }
      } catch (err) {
        console.error('Failed to load wholesale catalog:', err);
      } finally {
        setLoadingCatalog(false);
      }
    }

    async function loadActivePOs() {
      try {
        const res = await fetch('/api/vendor/b2b/orders', { credentials: 'include' });
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          setActivePOs(data.orders);
        }
      } catch (err) {
        console.error('Failed to load active POs:', err);
      }
    }

    loadCatalogData();
    loadActivePOs();
  }, []);

  // 2. Fetch Active Credit Line (MaxAB SNPL model)
  useEffect(() => {
    async function fetchCreditLine() {
      try {
        const res = await fetch('/api/vendor/credit', { credentials: 'include' });
        const data = await res.json();
        if (data.success && data.hasFacility && data.facility?.status === 'active') {
          setCreditFacility({
            creditLimit: Number(data.facility.creditLimit || 0),
            availableCredit: Number(data.facility.availableCredit || 0),
            drawnAmount: Number(data.facility.drawnAmount || 0),
            interestRateBps: Number(data.facility.interestRateBps || 250),
            maxTenorDays: Number(data.facility.maxTenorDays || 14),
            status: data.facility.status,
          });
          setPaymentMethod('credit_financing');
        } else {
          setPaymentMethod('PREPAID_WALLET');
        }
      } catch (err) {
        console.error('Failed to query vendor credit line:', err);
        setPaymentMethod('PREPAID_WALLET');
      } finally {
        setLoadingCredit(false);
      }
    }

    fetchCreditLine();
  }, []);

  const cartList = useMemo(() => Object.values(cart), [cart]);
  const cartSubtotal = useMemo(
    () => cartList.reduce((sum, item) => sum + item.tierPrice * item.orderQuantity, 0),
    [cartList]
  );
  const flatDeliveryFee = cartList.length > 0 ? 5000 : 0;
  const cartTotal = cartSubtotal + flatDeliveryFee;

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category || 'General'));
    return ['All', ...Array.from(set)];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.wholesalerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [items, searchQuery, selectedCategory]);

  const handleUpdateQuantity = (item: WholesaleTierItem, delta: number) => {
    setCart((prev) => {
      const current = prev[item.id]?.orderQuantity || 0;
      const nextQty = current + delta;

      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }

      if (nextQty < item.minOrderQuantity && delta > 0) {
        return {
          ...prev,
          [item.id]: { ...item, orderQuantity: item.minOrderQuantity },
        };
      }

      if (nextQty < item.minOrderQuantity && delta < 0) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }

      return {
        ...prev,
        [item.id]: { ...item, orderQuantity: nextQty },
      };
    });
  };

  const handlePlaceOrder = async () => {
    if (cartList.length === 0) return;
    setSubmittingOrder(true);
    setFeedback(null);

    const firstItem = cartList[0];
    const isWholesalerUniform = cartList.every((i) => i.wholesalerId === firstItem.wholesalerId);

    if (!isWholesalerUniform) {
      setFeedback({
        type: 'error',
        message: 'All items in a single purchase order must originate from the same wholesaler.',
      });
      setSubmittingOrder(false);
      return;
    }

    if (
      paymentMethod === 'credit_financing' &&
      creditFacility &&
      cartTotal > creditFacility.availableCredit
    ) {
      setFeedback({
        type: 'error',
        message: `Order total (UGX ${cartTotal.toLocaleString()}) exceeds your available SNPL credit limit (UGX ${creditFacility.availableCredit.toLocaleString()}).`,
      });
      setSubmittingOrder(false);
      return;
    }

    const payload = {
      vendorSlug: 'bonus-store-kololo',
      wholesalerVendorId: firstItem.wholesalerId || '3da236cf-9063-4e4e-bb3c-ec4ac9c91ddb',
      paymentTerms: paymentMethod,
      deliveryAddress: 'Store Reception / Kitchen Loading Bay',
      items: cartList.map((item) => ({
        productId: item.productId || item.id,
        name: item.name || 'Wholesale Item',
        unitOfMeasure: item.unitOfMeasure || 'unit',
        quantity: Number(item.orderQuantity || 1),
        unitPrice: Number(item.tierPrice || 0),
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
          message: `${paymentMethod === 'credit_financing' ? 'SNPL Order' : 'Order'} ${data.orderNumber} placed! PIN: ${data.handoverPin}`,
        });

        if (paymentMethod === 'credit_financing' && creditFacility) {
          setCreditFacility((prev) =>
            prev
              ? {
                  ...prev,
                  availableCredit: prev.availableCredit - cartTotal,
                  drawnAmount: prev.drawnAmount + cartTotal,
                }
              : null
          );
        }

        setActivePOs((prev) => [
          {
            orderNumber: data.orderNumber,
            status: 'SUBMITTED',
            totalAmount: cartTotal,
            paymentTerms: paymentMethod === 'credit_financing' ? 'SNPL' : 'PREPAID_WALLET',
            handoverPin: data.handoverPin,
            wholesalerName: firstItem.wholesalerName,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);

        setCart({});
        setActiveTab('active_pos');
      } else {
        setFeedback({ type: 'error', message: data.message || 'Failed to place purchase order.' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to communicate with procurement service.' });
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-8">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/vendor/dashboard"
              className="text-xs uppercase font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              &larr; Terminal Dashboard
            </Link>
            <span className="text-slate-400">/</span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">B2B Marketplace</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Stock Procurement</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Source high-velocity ingredients and packaged goods directly from verified Kampala suppliers.
          </p>
        </div>

        {/* Credit Line Status Card */}
        {creditFacility && (
          <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-xl p-4 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black">
              UGX
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                SNPL Working Capital Limit
              </div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                UGX {creditFacility.availableCredit.toLocaleString()}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  / {creditFacility.creditLimit.toLocaleString()}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                <span>{creditFacility.maxTenorDays}d Term @ {(creditFacility.interestRateBps / 100).toFixed(1)}% flat fee</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`max-w-7xl mx-auto mb-6 p-4 rounded-xl border flex items-center justify-between text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-800 dark:text-rose-200'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="font-bold ml-4">
            &times;
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto flex gap-4 border-b border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'catalog'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          Wholesale Suppliers Catalog
        </button>
        <button
          onClick={() => setActiveTab('active_pos')}
          className={`pb-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'active_pos'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          Active Purchase Orders
          {activePOs.length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 font-bold">
              {activePOs.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Catalog or Active POs */}
        <div className="lg:col-span-2">
          {activeTab === 'catalog' ? (
            <>
              {/* Search & Category Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <input
                  type="text"
                  placeholder="Search item, flour, milk, soda, supplier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Grid */}
              {loadingCatalog ? (
                <div className="p-12 text-center text-slate-400">Loading wholesale inventory...</div>
              ) : filteredItems.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400">
                  No products found matching your search.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredItems.map((item) => {
                    const inCartQty = cart[item.id]?.orderQuantity || 0;
                    return (
                      <div
                        key={item.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {item.category}
                            </span>
                            <span>MOQ: {item.minOrderQuantity} {item.unitOfMeasure}</span>
                          </div>
                          <h3 className="font-bold text-base mb-1">{item.name}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                            Supplier: <span className="font-medium text-slate-700 dark:text-slate-300">{item.wholesalerName}</span>
                          </p>
                          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mb-4">
                            UGX {item.tierPrice.toLocaleString()}
                            <span className="text-xs font-normal text-slate-400 ml-1">/ {item.unitOfMeasure}</span>
                          </div>
                        </div>

                        {/* Add to Cart Controls */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                          {inCartQty === 0 ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item, item.minOrderQuantity)}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors"
                            >
                              Add to PO (Min {item.minOrderQuantity})
                            </button>
                          ) : (
                            <div className="flex items-center justify-between w-full">
                              <span className="text-xs text-slate-500 font-semibold">In Order:</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuantity(item, -1)}
                                  className="w-7 h-7 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center font-black hover:bg-slate-200 dark:hover:bg-slate-700"
                                >
                                  -
                                </button>
                                <span className="text-sm font-bold w-6 text-center">{inCartQty}</span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQuantity(item, 1)}
                                  className="w-7 h-7 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center font-black hover:bg-slate-200 dark:hover:bg-slate-700"
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
            </>
          ) : (
            /* Active Purchase Orders Tab */
            <div className="space-y-4">
              {activePOs.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400">
                  No active purchase orders placed yet.
                </div>
              ) : (
                activePOs.map((po) => (
                  <div
                    key={po.orderNumber}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-black text-slate-800 dark:text-slate-200">{po.orderNumber}</span>
                        <span className="text-xs px-2 py-0.5 rounded font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                          {po.status}
                        </span>
                        {po.paymentTerms === 'SNPL' && (
                          <span className="text-xs px-2 py-0.5 rounded font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                            SNPL FINANCED
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Supplier: <span className="font-semibold text-slate-700 dark:text-slate-300">{po.wholesalerName}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Placed: {new Date(po.createdAt).toLocaleDateString()} at {new Date(po.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-0 pt-3 sm:pt-0 border-slate-100 dark:border-slate-800">
                      <div className="text-base font-black text-slate-900 dark:text-slate-100">
                        UGX {po.totalAmount.toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Handover PIN: <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">{po.handoverPin}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Column: Checkout Drawer */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm sticky top-6">
            <h2 className="text-base font-bold mb-4 flex items-center justify-between">
              <span>Restocking Cart</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {cartList.length} line {cartList.length === 1 ? 'item' : 'items'}
              </span>
            </h2>

            {cartList.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                Cart is currently empty.
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-60 overflow-y-auto mb-4 pr-1">
                  {cartList.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex-1 pr-2">
                        <div className="font-semibold line-clamp-1">{item.name}</div>
                        <div className="text-slate-400">
                          {item.orderQuantity} &times; UGX {item.tierPrice.toLocaleString()}
                        </div>
                      </div>
                      <div className="font-black text-slate-800 dark:text-slate-200">
                        UGX {(item.orderQuantity * item.tierPrice).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotals & Delivery */}
                <div className="space-y-2 text-xs pt-2 border-t border-slate-200 dark:border-slate-800 mb-4">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span>UGX {cartSubtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Flat Cargo Logistics:</span>
                    <span>UGX {flatDeliveryFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-slate-100 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span>Total Required:</span>
                    <span>UGX {cartTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Fintech / SNPL Payment Selector */}
                {creditFacility && (
                  <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                        Financing Options
                      </span>
                      <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">
                        UGX {creditFacility.availableCredit.toLocaleString()} Available
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('credit_financing')}
                        className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all border text-center ${
                          paymentMethod === 'credit_financing'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        SNPL Credit
                        <span className="block text-[10px] font-normal opacity-80 mt-0.5">Pay in 14 Days</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('PREPAID_WALLET')}
                        className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all border text-center ${
                          paymentMethod === 'PREPAID_WALLET'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Wallet Cash
                        <span className="block text-[10px] font-normal opacity-80 mt-0.5">Debit Immediate</span>
                      </button>
                    </div>

                    {paymentMethod === 'credit_financing' && (
                      <div className="text-[11px] text-emerald-800 dark:text-emerald-300/80 mt-2">
                        Financing fee: UGX {Math.round(cartTotal * (creditFacility.interestRateBps / 10000)).toLocaleString()} ({(creditFacility.interestRateBps / 100).toFixed(1)}%).
                        Total due: UGX {(cartTotal + Math.round(cartTotal * (creditFacility.interestRateBps / 10000))).toLocaleString()}.
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  disabled={submittingOrder}
                  onClick={handlePlaceOrder}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  {submittingOrder ? (
                    'Processing Order...'
                  ) : paymentMethod === 'credit_financing' ? (
                    'Confirm SNPL Restock Order'
                  ) : (
                    'Confirm Wallet Order'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}