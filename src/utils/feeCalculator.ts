// src/utils/feeCalculator.ts

export type PaymentMethod = 'pesapal' | 'cod';

export interface ZoneTariff {
  floorFee: number;   // e.g., 5000 (Ntinda) or 6000 (Najjera)
  ceilingFee: number; // e.g., 8000 (Ntinda) or 9000 (Najjera)
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface FeeCalculationParams {
  productSubtotal: number;       // A (in UGX)
  vendorLocation: Coordinates;
  deliveryLocation: Coordinates;
  zone: ZoneTariff;
  paymentMethod: PaymentMethod;
}

export interface CustomerReceipt {
  productSubtotal: number;       // A
  distanceKm: number;            // Evaluated distance
  riderDeliveryComponent: number;// D_rider
  serviceFee: number;            // 0 if A > 25,000 else 1,500
  deliveryFeeShown: number;      // D_shown = D_rider + service
  damageProtectionFee: number;   // G = max(200, 2.5% * (A + D_rider + service))
  convenienceFee: number;        // P (3.5% Pesapal pass-through, 0 for COD)
  totalUnrounded: number;        // Raw sum before rounding
  finalPayable: number;          // Total customer pays now + on arrival
  codRoundingSurplus: number;    // 0-99 UGX surplus (credited to platform)
  codDepositDueNow: number;      // 50% of A (if COD)
  codCashDueOnDelivery: number;  // Remaining balance in physical cash
}

export interface LedgerBreakdown {
  riderPayout: number;           // 85% of D_rider
  platformDeliveryShare: number; // 15% of D_rider
  platformServiceFee: number;    // service fee (1,500 or 0)
  platformCommission: number;    // 2.5% of A
  vendorPayout: number;          // 97.5% of A
  damageReserveCredit: number;   // G
  paymentGatewayFee: number;     // P (remitted to Pesapal)
  roundingSurplus: number;       // 0-99 UGX
}

export interface FeeCalculationResult {
  receipt: CustomerReceipt;
  ledger: LedgerBreakdown;
}

/**
 * Calculates the great-circle distance between two coordinates in kilometers (Haversine formula).
 */
export function calculateHaversineDistance(coord1: Coordinates, coord2: Coordinates): number {
  const EARTH_RADIUS_KM = 6371;

  const toRad = (degree: number) => (degree * Math.PI) / 180;

  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);

  const lat1 = toRad(coord1.latitude);
  const lat2 = toRad(coord2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return parseFloat((EARTH_RADIUS_KM * c).toFixed(2));
}

/**
 * v11.4 Core Pricing & Ledger Allocation Engine
 */
export function calculateOrderFees(params: FeeCalculationParams): FeeCalculationResult {
  const { productSubtotal: A, vendorLocation, deliveryLocation, zone, paymentMethod } = params;

  // 1. Distance Calculation
  const distanceKm = calculateHaversineDistance(vendorLocation, deliveryLocation);

  // 2. D_rider: Base (1,500) + 1,500/km clamped to zone floor & ceiling
  const rawRiderFee = Math.round(1500 + 1500 * distanceKm);
  const D_rider = Math.min(Math.max(rawRiderFee, zone.floorFee), zone.ceilingFee);

  // 3. Service Fee: 1,500 waived if product subtotal > 25,000 UGX
  const service = A > 25000 ? 0 : 1500;
  const D_shown = D_rider + service;

  // 4. Damage Protection: max(200, 2.5% * (A + D_rider + service))
  const baseForProtection = A + D_rider + service;
  const G = Math.round(Math.max(200, 0.025 * baseForProtection));

  // 5. Payment Gateway Fee (Pesapal 3.5% pass-through, 0 for COD)
  const P =
    paymentMethod === 'pesapal'
      ? Math.round(0.035 * (A + D_rider + service + G))
      : 0;

  const totalUnrounded = A + D_shown + G + P;

  // 6. Cash Rounding & Payment Splits
  let finalPayable = totalUnrounded;
  let roundingSurplus = 0;
  let codDepositDueNow = 0;
  let codCashDueOnDelivery = 0;

  if (paymentMethod === 'cod') {
    // Total_cod_cash = ceil(Total / 100) * 100
    finalPayable = Math.ceil(totalUnrounded / 100) * 100;
    roundingSurplus = finalPayable - totalUnrounded;

    // 50% deposit of product subtotal paid via MoMo upfront
    codDepositDueNow = Math.round(0.5 * A);
    // Balance collected by rider at the door
    codCashDueOnDelivery = finalPayable - codDepositDueNow;
  }

  // 7. Ledger Splits (Internal Accounting)
  const riderPayout = Math.round(0.85 * D_rider);
  const platformDeliveryShare = D_rider - riderPayout; // Exact remainder (15%)
  const platformCommission = Math.round(0.025 * A);
  const vendorPayout = A - platformCommission;         // Exact remainder (97.5%)

  return {
    receipt: {
      productSubtotal: A,
      distanceKm,
      riderDeliveryComponent: D_rider,
      serviceFee: service,
      deliveryFeeShown: D_shown,
      damageProtectionFee: G,
      convenienceFee: P,
      totalUnrounded,
      finalPayable,
      codRoundingSurplus: roundingSurplus,
      codDepositDueNow,
      codCashDueOnDelivery,
    },
    ledger: {
      riderPayout,
      platformDeliveryShare,
      platformServiceFee: service,
      platformCommission,
      vendorPayout,
      damageReserveCredit: G,
      paymentGatewayFee: P,
      roundingSurplus,
    },
  };
}