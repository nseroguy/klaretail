// src/utils/geo.ts
export type Coordinate = [number, number]; // [longitude, latitude]

export function isPointInPolygon(point: Coordinate, polygon: Coordinate[]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

export function resolveZone(
  customerCoord: Coordinate,
  activeZones: Array<{ id: string; name: string; polygon: Coordinate[] }>
): { zoneId: string; zoneName: string } | null {
  for (const zone of activeZones) {
    if (isPointInPolygon(customerCoord, zone.polygon)) {
      return { zoneId: zone.id, zoneName: zone.name };
    }
  }
  return null; // Explicit OUT_OF_ZONE (no centroid guessing)
}