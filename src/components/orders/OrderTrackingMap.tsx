'use client';

import React, { useEffect, useRef } from 'react';

interface TrackingMapProps {
  customerCoords?: { lat: number; lng: number; address?: string };
  vendorCoords?: { lat: number; lng: number; name?: string };
  riderCoords?: { lat: number; lng: number; name?: string };
  status: string;
}

export default function OrderTrackingMap({
  customerCoords = { lat: 0.3644, lng: 32.6515, address: 'Kyaliwajala Drop-Off' }, // Default: Kyaliwajala
  vendorCoords = { lat: 0.3689, lng: 32.6288, name: 'Kiwaatule Grill' },          // Default: Kiwaatule
  riderCoords = { lat: 0.3665, lng: 32.6395, name: 'Brian Mukasa' },             // Mid-route en-route
  status,
}: TrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    // Dynamically load Leaflet client-side to prevent SSR window reference crashes
    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }

      // Initialize Map centered between vendor and drop-off
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([customerCoords.lat, customerCoords.lng], 14);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Dark/Clean CartoDB Tile Layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map);

      // Custom marker icon helper
      const createIcon = (emoji: string, bgClass: string) =>
        L.divIcon({
          className: 'custom-leaflet-icon',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:${bgClass};box-shadow:0 4px 10px rgba(0,0,0,0.3);font-size:18px;border:2px solid white;">${emoji}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

      const bounds: [number, number][] = [];

      // 1. Vendor Marker
      if (vendorCoords.lat && vendorCoords.lng) {
        L.marker([vendorCoords.lat, vendorCoords.lng], {
          icon: createIcon('🍳', '#10b981'),
        })
          .addTo(map)
          .bindPopup(`<b>${vendorCoords.name || 'Vendor'}</b><br/>Pickup Origin`);
        bounds.push([vendorCoords.lat, vendorCoords.lng]);
      }

      // 2. Customer Destination Marker
      if (customerCoords.lat && customerCoords.lng) {
        L.marker([customerCoords.lat, customerCoords.lng], {
          icon: createIcon('📍', '#ef4444'),
        })
          .addTo(map)
          .bindPopup(`<b>Destination</b><br/>${customerCoords.address || 'Drop-Off'}`);
        bounds.push([customerCoords.lat, customerCoords.lng]);
      }

      // 3. Courier Marker (when dispatched)
      if (status !== 'created' && riderCoords.lat && riderCoords.lng) {
        L.marker([riderCoords.lat, riderCoords.lng], {
          icon: createIcon('🛵', '#059669'),
        })
          .addTo(map)
          .bindPopup(`<b>${riderCoords.name || 'Courier'}</b><br/>Live En-Route`);
        bounds.push([riderCoords.lat, riderCoords.lng]);

        // Draw transit line between Courier and Customer
        L.polyline(
          [
            [riderCoords.lat, riderCoords.lng],
            [customerCoords.lat, customerCoords.lng],
          ],
          {
            color: '#10b981',
            weight: 4,
            opacity: 0.8,
            dashArray: '6, 8',
          }
        ).addTo(map);
      } else if (vendorCoords.lat && customerCoords.lat) {
        // Draw baseline route between Vendor and Customer
        L.polyline(
          [
            [vendorCoords.lat, vendorCoords.lng],
            [customerCoords.lat, customerCoords.lng],
          ],
          {
            color: '#6b7280',
            weight: 3,
            opacity: 0.5,
            dashArray: '4, 6',
          }
        ).addTo(map);
      }

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }

      mapInstanceRef.current = map;
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [customerCoords, vendorCoords, riderCoords, status]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-md">
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      <div ref={mapContainerRef} className="h-64 w-full z-10" />
      <div className="absolute top-2 left-2 z-20 flex gap-2">
        <span className="rounded-lg bg-zinc-950/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 backdrop-blur-md border border-zinc-800 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Live Route Tracking
        </span>
      </div>
    </div>
  );
}
