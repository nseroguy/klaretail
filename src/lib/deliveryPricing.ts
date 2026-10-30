export interface CartItemPricing {
  id: string;
  name: string;
  price: number; // Net vendor price or raw item price
  quantity: number;
  weightKg?: number;
}

export interface DeliveryCalculationParams {
  vendorSector?: string;
  vendorSubCategory?: string;
  channel?: "retail" | "wholesale";
  vendorLat: number;
  vendorLng: number;
  customerLat: number;
  customerLng: number;
  items: CartItemPricing[];
}

export interface DeliveryCalculationResult {
  distanceKm: number;
  totalWeightKg: number;
  deliveryFee: number;
  tierLabel: string;
  requiresCustomFreightQuote?: boolean;
}

/**
 * Applies the 2% wholesale markup for display on customer storefronts and cart.
 * Rounded to the nearest whole UGX.
 */
export function getWholesaleDisplayPrice(vendorPrice: number): number {
  return Math.round(vendorPrice * 1.02);
}

/**
 * Calculates straight-line distance via Haversine and applies
 * a 1.35x road circuity factor to reflect Kampala road network geometry.
 */
export function calculateRoadDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const haversineKm = R * c;

  // 1.35x circuity factor, rounded to 1 decimal place
  return Math.max(0.5, Math.round(haversineKm * 1.35 * 10) / 10);
}

/**
 * Computes sector-aware and weight-tiered delivery fees.
 */
export function computeSectorDeliveryFee({
  vendorSector,
  vendorSubCategory,
  channel,
  vendorLat,
  vendorLng,
  customerLat,
  customerLng,
  items,
}: DeliveryCalculationParams): DeliveryCalculationResult {
  const distanceKm = calculateRoadDistanceKm(vendorLat, vendorLng, customerLat, customerLng);
  
  // Compute aggregate order weight in kg (default 1 kg per item if unspecified)
  const totalWeightKg = items.reduce(
    (sum, item) => sum + (Number(item.weightKg) || 1.0) * (Number(item.quantity) || 1),
    0
  );

  const isWholesale = channel === "wholesale" || vendorSector === "wholesale";
  const extraDistanceKm = Math.max(0, Math.ceil(distanceKm - 2));

  // --- 1. WHOLESALE WEIGHT & DISTANCE LOGIC ---
  if (isWholesale) {
    // Over 500 kg: Exceeds standard courier limit
    if (totalWeightKg > 500) {
      return {
        distanceKm,
        totalWeightKg,
        deliveryFee: 50000,
        tierLabel: `Heavy Cargo (${totalWeightKg.toFixed(1)} kg, ${distanceKm} km) - Truck Dispatch Required`,
        requiresCustomFreightQuote: true,
      };
    }

    // Tier 1: Below 15 kg
    if (totalWeightKg < 15) {
      const fee = 3000 + extraDistanceKm * 800;
      return {
        distanceKm,
        totalWeightKg,
        deliveryFee: fee,
        tierLabel: `Wholesale Light (<15kg, ${distanceKm} km)`,
      };
    }

    // Tier 2: 15 kg up to 40 kg
    if (totalWeightKg <= 40) {
      const fee = 5000 + extraDistanceKm * 1000;
      return {
        distanceKm,
        totalWeightKg,
        deliveryFee: fee,
        tierLabel: `Wholesale Medium (${totalWeightKg.toFixed(1)}kg, ${distanceKm} km)`,
      };
    }

    // Tier 3: 40 kg up to 500 kg
    // Base 8,000 for first 2 km, 1,500/km beyond 2km, plus 300 UGX/kg for weight over 50kg
    const extraWeightKg = Math.max(0, Math.ceil(totalWeightKg - 50));
    const distanceCharge = 8000 + extraDistanceKm * 1500;
    const weightCharge = extraWeightKg * 300;
    const fee = distanceCharge + weightCharge;

    return {
      distanceKm,
      totalWeightKg,
      deliveryFee: fee,
      tierLabel: `Wholesale Freight (${totalWeightKg.toFixed(1)}kg, ${distanceKm} km)`,
    };
  }

  // --- 2. FAST FOOD / QUICK SERVICE ---
  if (vendorSubCategory === "fast_food") {
    const fee = 2500 + extraDistanceKm * 800;
    return {
      distanceKm,
      totalWeightKg,
      deliveryFee: fee,
      tierLabel: `Fast Food Express (${distanceKm} km)`,
    };
  }

  // --- 3. RESTAURANT & DINE-IN HYBRID ---
  if (vendorSector === "food_beverage" || vendorSubCategory === "restaurant") {
    const extraRestKm = Math.max(0, Math.ceil(distanceKm - 3));
    const fee = 3500 + extraRestKm * 1000;
    return {
      distanceKm,
      totalWeightKg,
      deliveryFee: fee,
      tierLabel: `Restaurant Courier (${distanceKm} km)`,
    };
  }

  // --- 4. STANDARD RETAIL / SUPERMARKET ---
  const extraRetailKm = Math.max(0, Math.ceil(distanceKm - 3));
  const fee = 3000 + extraRetailKm * 700;
  return {
    distanceKm,
    totalWeightKg,
    deliveryFee: fee,
    tierLabel: `Retail Delivery (${distanceKm} km)`,
  };
}
