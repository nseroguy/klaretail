"use client";

import dynamic from "next/dynamic";

const LocationPickerMap = dynamic(
  () => import("@/components/checkout/LocationPickerMap"),
  { ssr: false }
);

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CheckoutAuthModal from '@/components/auth/CheckoutAuthModal';
import { Banknote, Smartphone, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH_ON_DELIVERY" | "MTN_MOMO" | "AIRTEL_MONEY" | "B2B_INVOICE">("CASH_ON_DELIVERY");
  const [channel, setChannel] = useState<"retail" | "wholesale">("retail");
  const [poNumber, setPoNumber] = useState("");
  const [taxId, setTaxId] = useState("");
  const [paymentTerms, setPaymentTerms] = useState<"immediate" | "net_15" | "net_30">("immediate");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [cartSummary, setCartSummary] = useState<{
    items: any[];
    subtotal: number;
    deliveryFee: number;
    channel: string;
    vendorId?: string;
    vendorSlug?: string;
  }>({
    items: [] as any[],
    subtotal: 0,
    deliveryFee: 3000,
    channel: "retail",
  });
  const [orderError, setOrderError] = useState<string | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number }>({
    lat: 0.3136,
    lng: 32.5811,
  });
  const [deliveryTierLabel, setDeliveryTierLabel] = useState<string>("");

  const handleLocationSelect = async (coords: { lat: number; lng: number }) => {
    setDeliveryCoords(coords);
    const vendorId = cartSummary.vendorId;
    if (!vendorId) return;

    try {
      const res = await fetch("/api/delivery/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          customerLat: coords.lat,
          customerLng: coords.lng,
          channel: cartSummary.channel,
          items: cartSummary.items,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCartSummary((prev) => ({
          ...prev,
          deliveryFee: data.deliveryFee,
        }));
        setDeliveryTierLabel(data.tierLabel);
      }
    } catch (err) {
      console.error("Failed to fetch delivery quote:", err);
    }
  };


  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlChannel = params.get("channel");
      if (urlChannel === "wholesale") {
        setChannel("wholesale");
        setPaymentMethod("B2B_INVOICE");
        setPaymentTerms("net_30");
      }
    }
    // Hydrate cart summary from local storage
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("cart") || localStorage.getItem("klaretail_cart");
        if (raw) {
          const parsed = JSON.parse(raw);
          const resolvedItems: any[] = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.items)
            ? parsed.items
            : typeof parsed?.items === "object" && parsed.items !== null
            ? Object.values(parsed.items)
            : [];

          const calculatedSubtotal = resolvedItems.reduce(
            (sum: number, it: any) => sum + (Number(it?.price) || 0) * (Number(it?.quantity) || 1),
            0
          );

          const isWholesale = (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("channel") === "wholesale") || parsed?.channel === "wholesale" || channel === "wholesale";
          const resolvedFee = Number(parsed?.deliveryFee) || (isWholesale ? 15000 : 3000);

          setCartSummary({
            items: resolvedItems,
            subtotal: Number(parsed?.subtotal) || calculatedSubtotal,
            deliveryFee: resolvedFee,
            channel: isWholesale ? "wholesale" : "retail",
            vendorId: parsed?.vendorId || parsed?.vendor?.id,
            vendorSlug: parsed?.vendorSlug || parsed?.vendor?.slug,
          });
        }
      } catch (e) {
        console.error("Failed to hydrate cartSummary:", e);
      }
    }

    async function loadProfile() {
      try {
        const res = await fetch('/api/customer/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.customer) {
            setCustomer(data.customer);
            setAddresses(data.addresses || []);
            const defaultAddr = data.addresses?.find((a: any) => a.isDefault);
            if (defaultAddr) setSelectedAddressId(defaultAddr.id);
            else if (data.addresses?.length > 0) setSelectedAddressId(data.addresses[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to pre-hydrate customer session:', err);
      }
    }
    loadProfile();
  }, []);

  const handleAuthSuccess = (authenticatedCustomer: any, customerAddresses: any[]) => {
    setCustomer(authenticatedCustomer);
    setAddresses(customerAddresses);
    const defaultAddr = customerAddresses.find((a: any) => a.isDefault);
    if (defaultAddr) {
      setSelectedAddressId(defaultAddr.id);
    } else if (customerAddresses.length > 0) {
      setSelectedAddressId(customerAddresses[0].id);
    }
  };

  const handlePlaceOrderClick = () => {
    if (!customer) {
      setIsAuthModalOpen(true);
      return;
    }
    submitFinalOrder();
  };

  const submitFinalOrder = async () => {
    setIsPlacingOrder(true);
    setOrderError(null);
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryAddressId: selectedAddressId,
          paymentMethod,
          channel,
          paymentTerms: channel === "wholesale" ? paymentTerms : "immediate",
          poNumber: channel === "wholesale" && poNumber ? poNumber.trim() : undefined,
          taxId: channel === "wholesale" && taxId ? taxId.trim() : undefined,
          ...(typeof window !== "undefined"
            ? (() => {
                try {
                  const raw = localStorage.getItem("cart") || localStorage.getItem("klaretail_cart");
                  if (raw) {
                    const parsed = JSON.parse(raw);
                    return {
                      vendorId: parsed.vendorId || parsed.vendor?.id,
                      vendorSlug: parsed.vendorSlug || parsed.vendor?.slug,
                      items: Array.isArray(parsed?.items) ? parsed.items : typeof parsed?.items === 'object' && parsed?.items !== null ? Object.values(parsed.items) : [],
                      subtotal: parsed.subtotal,
                      deliveryFee: parsed.deliveryFee,
                    };
                  }
                } catch {}
                return {};
              })()
            : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Order failed.');

      // Route based on payment method
      if (paymentMethod !== "CASH_ON_DELIVERY") {
        try {
          const pesaRes = await fetch("/api/pesapal/submit-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: data.orderId }),
          });
          const pesaData = await pesaRes.json();
          if (pesaData.redirect_url || pesaData.redirectUrl) {
            window.location.href = pesaData.redirect_url || pesaData.redirectUrl;
            return;
          }
        } catch (pesaErr) {
          console.error("Pesapal submission failed:", pesaErr);
        }
      }

      router.push(`/orders/${data.orderId}`);
    } catch (err: any) {
      setOrderError(err.message);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6 font-sans text-zinc-900 dark:text-zinc-100">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Checkout</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Identity, Delivery & Payment */}
        <div className="md:col-span-2 space-y-6">
          
          {/* 1. Identity */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-3">
              1. Customer Identity
            </h2>
            {customer ? (
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-white">{customer.fullName}</p>
                  <p className="text-xs text-zinc-500">{customer.phone} • {customer.email || 'No email added'}</p>
                </div>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Switch Account
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-sm">
                <p className="text-xs text-zinc-500">Checking out as guest. SMS OTP confirmation required.</p>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  Log In
                </button>
              </div>
            )}
          </div>

          {/* 2. Drop-off Location */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-3">
              2. Delivery Drop-Off
            </h2>
            {addresses.length > 0 ? (
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                      selectedAddressId === addr.id
                        ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : 'border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliveryAddress"
                      checked={selectedAddressId === addr.id}
                      onChange={() => setSelectedAddressId(addr.id)}
                      className="mt-1 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase text-zinc-800 dark:text-zinc-200">
                          {addr.label}
                        </span>
                        {addr.isDefault && (
                          <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">{addr.addressLine}</p>
                      {addr.landmark && <p className="text-xs text-zinc-500">Near: {addr.landmark}</p>}
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                {customer ? 'No saved addresses found. Add an address to proceed.' : 'Log in to select your saved delivery address.'}
              </p>
            )}
          
            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <LocationPickerMap
                initialLat={deliveryCoords.lat}
                initialLng={deliveryCoords.lng}
                onLocationSelect={handleLocationSelect}
              />
              {deliveryTierLabel && (
                <div className="mt-2 text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                  {deliveryTierLabel}
                </div>
              )}
            </div>
          </div>

          {/* 3. Payment Method Picker */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-3">
              3. Payment Method
            </h2>
            <div className="space-y-2.5">
              
              {/* Cash On Delivery */}
              <label
                className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition ${
                  paymentMethod === 'CASH_ON_DELIVERY'
                    ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CASH_ON_DELIVERY"
                    checked={paymentMethod === 'CASH_ON_DELIVERY'}
                    onChange={() => setPaymentMethod('CASH_ON_DELIVERY')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <Banknote className="h-4 w-4 text-emerald-500" /> Cash on Delivery (COD)
                    </p>
                    <p className="text-xs text-zinc-500">Pay physical cash to the courier upon delivery</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-zinc-500">UGX Cash</span>
              </label>

              {/* MTN MoMo */}
              <label
                className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition ${
                  paymentMethod === 'MTN_MOMO'
                    ? 'border-yellow-500 bg-yellow-50/30 dark:bg-yellow-950/20'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="MTN_MOMO"
                    checked={paymentMethod === 'MTN_MOMO'}
                    onChange={() => setPaymentMethod('MTN_MOMO')}
                    className="text-yellow-500 focus:ring-yellow-500"
                  />
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4 text-yellow-500" /> MTN Mobile Money
                    </p>
                    <p className="text-xs text-zinc-500">Instant USSD prompt sent to your MTN phone</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded">MoMo Pay</span>
              </label>

              {/* Airtel Money */}
              <label
                className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition ${
                  paymentMethod === 'AIRTEL_MONEY'
                    ? 'border-red-500 bg-red-50/30 dark:bg-red-950/20'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="AIRTEL_MONEY"
                    checked={paymentMethod === 'AIRTEL_MONEY'}
                    onChange={() => setPaymentMethod('AIRTEL_MONEY')}
                    className="text-red-500 focus:ring-red-500"
                  />
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4 text-red-500" /> Airtel Money
                    </p>
                    <p className="text-xs text-zinc-500">Push PIN approval to your Airtel number</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">Airtel Pay</span>
              </label>

            </div>
          </div>
        </div>

        {/* Right Column: Order Breakdown & Submission */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 bg-white dark:bg-zinc-900 shadow-sm h-fit space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Order Summary</h2>
          <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex justify-between">
              <span>Items Subtotal ({(Array.isArray(cartSummary?.items) ? cartSummary.items : []).reduce((acc: number, i: any) => acc + (Number(i?.quantity) || 1), 0)} items)</span>
              <span className="font-mono">UGX {cartSummary.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Fee {deliveryTierLabel ? `(${deliveryTierLabel})` : cartSummary.channel === "wholesale" ? "(Freight)" : "(Express)"}</span>
              <span className="font-mono">UGX {cartSummary.deliveryFee.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex justify-between font-bold text-base">
            <span>Total Amount</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">
              UGX {(cartSummary.subtotal + cartSummary.deliveryFee).toLocaleString()}
            </span>
          </div>

          {orderError && (
            <div className="rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/30 p-3 text-xs text-red-600 dark:text-red-400">
              {orderError}
            </div>
          )}

          <button
            onClick={handlePlaceOrderClick}
            disabled={isPlacingOrder}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950 hover:bg-emerald-500 disabled:opacity-50 transition"
          >
            {isPlacingOrder ? 'Confirming Order...' : customer ? `Place Order • ${paymentMethod === 'CASH_ON_DELIVERY' ? 'Pay Cash' : 'Pay Mobile Money'}` : 'Continue to Checkout'}
          </button>
        </div>
      </div>

      <CheckoutAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthenticated={handleAuthSuccess}
      />
    </div>
  );
}