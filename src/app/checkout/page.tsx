'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCart } from '@/context/CartContext';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  CreditCard, 
  AlertCircle, 
  ChevronRight, 
  ShoppingBag, 
  ArrowLeft, 
  Banknote, 
  KeyRound 
} from 'lucide-react';

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-56 bg-neutral-100 rounded-2xl flex items-center justify-center text-xs text-neutral-400">
      Loading interactive map picker...
    </div>
  ),
});

interface ZoneOption {
  id: string;
  name: string;
  floorFee: number;
  ceilingFee: number;
}

const SAMPLE_ZONES: ZoneOption[] = [
  { id: '1', name: 'Ntinda / Ministers Village', floorFee: 4000, ceilingFee: 7000 },
  { id: '2', name: 'Kiwaatule / Post Office', floorFee: 4500, ceilingFee: 7500 },
  { id: '3', name: 'Najjera 1 & 2', floorFee: 5000, ceilingFee: 8500 },
  { id: '4', name: 'Kisaasi / Kulambiro Ring', floorFee: 5000, ceilingFee: 8500 },
  { id: '5', name: 'Bukoto / Naguru', floorFee: 5500, ceilingFee: 9000 },
  { id: '6', name: 'Kampala Central / CBD', floorFee: 6000, ceilingFee: 10000 },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items: cartItems, subtotal: productSubtotal, clearCart } = useCart();

  const [selectedZone, setSelectedZone] = useState<ZoneOption>(SAMPLE_ZONES[0]);
  const [deliveryMode, setDeliveryMode] = useState<'asap' | 'scheduled'>('asap');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'momo'>('cod');
  const [customerName, setCustomerName] = useState('Sarah Namubiru');
  const [customerPhone, setCustomerPhone] = useState('0772123456');
  const [customerEmail, setCustomerEmail] = useState('sarah.namu@gmail.com');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Exact location coordinates
  const [locationCoords, setLocationCoords] = useState<{
    lat: number;
    lng: number;
    address: string;
    distanceKm: number;
  }>({
    lat: 0.3541,
    lng: 32.6183,
    address: 'Ntinda Ministers Village, Kampala',
    distanceKm: 0.8,
  });

  const availableSlots = useMemo(() => {
    const slots = [];
    const base = new Date();
    base.setHours(base.getHours() + 1);
    base.setMinutes(Math.ceil(base.getMinutes() / 15) * 15, 0, 0);

    for (let i = 0; i < 6; i++) {
      const slotTime = new Date(base.getTime() + i * 15 * 60 * 1000);
      const timeStr = slotTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const endTimeStr = new Date(slotTime.getTime() + 15 * 60 * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      slots.push({
        id: slotTime.toISOString(),
        label: `${timeStr} - ${endTimeStr}`,
      });
    }
    return slots;
  }, []);

  useEffect(() => {
    if (availableSlots.length > 0 && !selectedSlot) {
      setSelectedSlot(availableSlots[0].id);
    }
  }, [availableSlots, selectedSlot]);

  // Exact distance-based tariff formula
  const pricing = useMemo(() => {
    const distanceKm = locationCoords.distanceKm || 1.0;
    const rawDelivery = selectedZone.floorFee + distanceKm * 400;
    const riderDeliveryComponent = Math.min(
      Math.max(Math.round(rawDelivery), selectedZone.floorFee),
      selectedZone.ceilingFee
    );

    const serviceFee = productSubtotal > 25000 ? 0 : 1500;
    const damageProtectionFee = Math.round(productSubtotal * 0.0324);
    const unroundedTotal = productSubtotal + riderDeliveryComponent + serviceFee + damageProtectionFee;
    const finalPayable = Math.ceil(unroundedTotal / 100) * 100;

    return {
      distanceKm,
      riderDeliveryComponent,
      serviceFee,
      damageProtectionFee,
      finalPayable,
    };
  }, [productSubtotal, selectedZone, locationCoords.distanceKm]);

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      setErrorMessage('Your cart is empty.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (paymentMethod === 'cod') {
        const res = await fetch('/api/orders/cod', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName,
            customerPhone,
            customerEmail,
            deliveryAddress: locationCoords.address,
            zoneId: selectedZone.id,
            zoneName: selectedZone.name,
            lat: locationCoords.lat,
            lng: locationCoords.lng,
            distanceKm: pricing.distanceKm,
            slotStart: deliveryMode === 'scheduled' ? selectedSlot : null,
            subtotal: productSubtotal,
            deliveryFee: pricing.riderDeliveryComponent,
            serviceFee: pricing.serviceFee,
            totalPayable: pricing.finalPayable,
            items: cartItems,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Failed to place COD order.');
        }

        clearCart();
        router.push(data.trackingUrl || `/orders/${data.orderId}`);
        return;
      }

      // Online mobile money route (Pesapal)
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotStart: deliveryMode === 'scheduled' ? selectedSlot : null,
          paymentMethod: 'momo',
          items: cartItems,
          customerDetails: { name: customerName, phone: customerPhone, email: customerEmail },
          pricing: {
            receipt: {
              productSubtotal,
              distanceKm: pricing.distanceKm,
              riderDeliveryComponent: pricing.riderDeliveryComponent,
              serviceFee: pricing.serviceFee,
              damageProtectionFee: pricing.damageProtectionFee,
              finalPayable: pricing.finalPayable,
            },
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to place order.');
      if (data.redirectUrl) window.location.href = data.redirectUrl;
      else router.push(`/payment/callback?OrderMerchantReference=${data.orderNumber}`);
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] py-10 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-600 hover:text-emerald-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Store
          </Link>
          <span className="text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
            Manual Dispatch & Escrow Handshake
          </span>
        </div>

        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <p className="text-sm font-medium">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleOrderSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. Zone & Area Corridor */}
            <div className="bg-white p-6 rounded-3xl shadow-xs border border-neutral-200/80">
              <label className="text-sm font-black text-neutral-900 flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-emerald-600" />
                1. Delivery Corridor & Operational Area
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SAMPLE_ZONES.map((zone) => (
                  <button
                    type="button"
                    key={zone.id}
                    onClick={() => setSelectedZone(zone)}
                    className={`text-left p-3 rounded-2xl border text-xs transition flex justify-between items-center cursor-pointer ${
                      selectedZone.id === zone.id
                        ? 'border-emerald-600 bg-emerald-50/50 text-neutral-900 font-bold'
                        : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                    }`}
                  >
                    <span>{zone.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Interactive Map Picker & GPS Auto-Location */}
            <div className="bg-white p-6 rounded-3xl shadow-xs border border-neutral-200/80">
              <LocationPicker
                onLocationSelect={(loc) => setLocationCoords(loc)}
                defaultLat={0.3541}
                defaultLng={32.6183}
              />
            </div>

            {/* 3. Dispatch Mode */}
            <div className="bg-white p-6 rounded-3xl shadow-xs border border-neutral-200/80">
              <label className="text-sm font-black text-neutral-900 flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-emerald-600" />
                3. Delivery Mode
              </label>
              <div className="flex gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setDeliveryMode('asap')}
                  className={`flex-1 py-3 rounded-2xl border text-sm font-bold transition cursor-pointer ${
                    deliveryMode === 'asap'
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-neutral-200 bg-white text-neutral-700'
                  }`}
                >
                  Standard / ASAP
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryMode('scheduled')}
                  className={`flex-1 py-3 rounded-2xl border text-sm font-bold transition cursor-pointer ${
                    deliveryMode === 'scheduled'
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-neutral-200 bg-white text-neutral-700'
                  }`}
                >
                  Schedule Window (15 min)
                </button>
              </div>

              {deliveryMode === 'scheduled' && (
                <div className="grid grid-cols-2 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      type="button"
                      key={slot.id}
                      onClick={() => setSelectedSlot(slot.id)}
                      className={`p-2.5 text-xs rounded-xl border text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        selectedSlot === slot.id
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                          : 'border-neutral-200 hover:border-neutral-300 text-neutral-600'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {slot.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Payment Method */}
            <div className="bg-white p-6 rounded-3xl shadow-xs border border-neutral-200/80">
              <label className="text-sm font-black text-neutral-900 flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                4. Payment Method
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                    paymentMethod === 'cod'
                      ? 'border-amber-500 bg-amber-50/60 font-bold ring-1 ring-amber-400'
                      : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-bold">Cash on Delivery (100%)</span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">Zero advance fee. Pay upon physical inspection.</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('momo')}
                  className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                    paymentMethod === 'momo'
                      ? 'border-emerald-600 bg-emerald-50/50 font-bold'
                      : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                  }`}
                >
                  <div className="text-sm font-bold">Online Mobile Money</div>
                  <div className="text-xs text-neutral-500 mt-1">Pay via MTN / Airtel MoMo (Pesapal).</div>
                </button>
              </div>

              {paymentMethod === 'cod' && (
                <div className="mt-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <KeyRound className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                  <p>
                    <strong>Escrow Handshake:</strong> A 4-digit PIN is generated on completion. Verify package contents with the courier, hand over the cash, and provide the PIN.
                  </p>
                </div>
              )}
            </div>

            {/* 5. Customer Contacts */}
            <div className="bg-white p-6 rounded-3xl shadow-xs border border-neutral-200/80 space-y-4">
              <label className="text-sm font-black text-neutral-900 block">5. Recipient Information</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-xs font-semibold text-neutral-500 mb-1 block">Recipient Name</span>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full text-sm p-3 rounded-xl border border-neutral-300 focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <span className="text-xs font-semibold text-neutral-500 mb-1 block">Phone Number</span>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full text-sm p-3 rounded-xl border border-neutral-300 focus:outline-emerald-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Ledger Breakdown Sidebar */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-xs border border-neutral-200/80 space-y-4">
              <h2 className="text-base font-black text-neutral-900 flex items-center justify-between border-b border-neutral-100 pb-3">
                <span className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                  Order Summary
                </span>
                <span className="text-xs text-neutral-500 font-normal">
                  {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
                </span>
              </h2>

              <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                {cartItems.map((it) => (
                  <div key={it.id} className="flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-neutral-800">{it.name}</span>
                      <span className="text-neutral-400 ml-1.5 font-mono">x{it.quantity}</span>
                    </div>
                    <span className="font-mono font-semibold text-neutral-900">
                      UGX {(it.price * it.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-neutral-100 space-y-2.5 text-xs text-neutral-600">
                <div className="flex justify-between">
                  <span>Product Subtotal</span>
                  <span className="font-mono font-bold text-neutral-900">UGX {productSubtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transport ({pricing.distanceKm} km from hub)</span>
                  <span className="font-mono">UGX {pricing.riderDeliveryComponent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Service Fee</span>
                  <span className="font-mono">
                    {pricing.serviceFee === 0 ? <span className="text-emerald-600 font-bold">WAIVED</span> : `UGX ${pricing.serviceFee.toLocaleString()}`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    Damage Protection (3.24%)
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  </span>
                  <span className="font-mono">UGX {pricing.damageProtectionFee.toLocaleString()}</span>
                </div>

                <div className="pt-3 border-t border-neutral-100 flex justify-between items-center text-base font-black text-neutral-950">
                  <span>Payable Total</span>
                  <span className="font-mono">UGX {pricing.finalPayable.toLocaleString()}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 space-y-2 text-xs">
                {paymentMethod === 'cod' ? (
                  <>
                    <div className="flex justify-between text-neutral-500">
                      <span>Online Advance Deposit:</span>
                      <span className="font-mono font-bold text-emerald-700">UGX 0 (None)</span>
                    </div>
                    <div className="flex justify-between font-bold text-amber-900 pt-1 border-t border-neutral-200">
                      <span>Cash Due on Handshake:</span>
                      <span className="font-mono font-black text-sm">UGX {pricing.finalPayable.toLocaleString()}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between font-bold text-emerald-800">
                    <span>Charged to Mobile Money:</span>
                    <span className="font-mono font-black">UGX {pricing.finalPayable.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || cartItems.length === 0}
                className={`w-full py-4 px-4 font-extrabold text-sm rounded-2xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 text-white ${
                  paymentMethod === 'cod'
                    ? 'bg-amber-600 hover:bg-amber-700 disabled:bg-neutral-300'
                    : 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300'
                }`}
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : paymentMethod === 'cod' ? (
                  <>
                    <span>Confirm COD & Get Handshake PIN</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Proceed to Pesapal Gateway</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
