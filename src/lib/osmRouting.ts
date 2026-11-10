export interface RouteResult {
  distanceKm: number;
  durationMin: number;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'KlaRetail-App/1.0 (contact@klaretail.online)' } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name
      };
    }
  } catch {
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'User-Agent': 'KlaRetail-App/1.0 (contact@klaretail.online)' } }
    );
    const data = await res.json();
    return data?.display_name || null;
  } catch {
    return null;
  }
}

export async function getOSRMRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteResult> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=false`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'KlaRetail-App/1.0 (contact@klaretail.online)' }
    });
    const data = await res.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        distanceKm: Math.round((route.distance / 1000) * 10) / 10,
        durationMin: Math.round(route.duration / 60)
      };
    }
  } catch {}

  // Fallback: Haversine straight-line distance x 1.3 road factor
  const R = 6371;
  const dLat = ((endLat - startLat) * Math.PI) / 180;
  const dLng = ((endLng - startLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((startLat * Math.PI) / 180) *
      Math.cos((endLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightKm = R * c;

  return {
    distanceKm: Math.round(straightKm * 1.3 * 10) / 10,
    durationMin: Math.round(straightKm * 1.3 * 2.5)
  };
}

export function calculateDeliveryFee(distanceKm: number, channel: 'retail' | 'wholesale' = 'retail'): number {
  if (channel === 'wholesale') {
    if (distanceKm <= 3) return 5000;
    return Math.round(5000 + (distanceKm - 3) * 800);
  } else {
    if (distanceKm <= 2) return 3000;
    return Math.round(3000 + (distanceKm - 2) * 600);
  }
}
