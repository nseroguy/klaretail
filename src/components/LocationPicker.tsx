'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Crosshair, Check } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface LocationPickerProps {
  onLocationSelect: (loc: { lat: number; lng: number; address: string; distanceKm: number }) => void;
  defaultLat?: number;
  defaultLng?: number;
}

// Hub coordinates: KlaRetail Ntinda Hub
const HUB_LAT = 0.3541;
const HUB_LNG = 32.6183;

// Haversine distance formula in KM
export function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
  return Math.round(R * c * 10) / 10;
}

export default function LocationPicker({
  onLocationSelect,
  defaultLat = 0.3541,
  defaultLng = 32.6183,
}: LocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: defaultLat,
    lng: defaultLng,
  });
  const [address, setAddress] = useState<string>('Ntinda Ministers Village, Kampala');
  const [distanceKm, setDistanceKm] = useState<number>(0.8);
  const [locating, setLocating] = useState(false);

  // Reverse geocode via OpenStreetMap Nominatim
  const fetchAddress = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await res.json();
      if (data && data.display_name) {
        const parts = data.display_name.split(',').slice(0, 3).join(',');
        setAddress(parts);
        return parts;
      }
    } catch (e) {
      console.warn('Geocoding fallback:', e);
    }
    const fallback = `Pin Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    setAddress(fallback);
    return fallback;
  };

  const updateLocation = async (lat: number, lng: number) => {
    setCoords({ lat, lng });
    const dist = calculateHaversineKm(HUB_LAT, HUB_LNG, lat, lng);
    setDistanceKm(dist);

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo([lat, lng]);
    }

    const resolvedAddress = await fetchAddress(lat, lng);
    onLocationSelect({
      lat,
      lng,
      address: resolvedAddress,
      distanceKm: dist,
    });
  };

  // Locate user with HTML5 GPS Geolocation
  const handleGPSDetect = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        updateLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLocating(false);
        alert(`Could not fetch exact GPS location: ${err.message}. Please tap your location on the map.`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!mapContainerRef.current || mapInstanceRef.current) return;
      const L = (await import('leaflet')).default;

      // Custom icon using standard SVG marker
      const customIcon = L.divIcon({
        className: 'custom-pin',
        html: `<div style="background:#00D084;width:24px;height:24px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 0 10px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">
                <div style="width:6px;height:6px;background:#0C0F0E;border-radius:50%;"></div>
              </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const map = L.map(mapContainerRef.current).setView([coords.lat, coords.lng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const marker = L.marker([coords.lat, coords.lng], {
        icon: customIcon,
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const { lat, lng } = marker.getLatLng();
        if (isMounted) updateLocation(lat, lng);
      });

      map.on('click', (e: any) => {
        if (isMounted) updateLocation(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-black text-neutral-900 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-600" />
          Tap Exact Delivery Location & Pin
        </label>
        <button
          type="button"
          onClick={handleGPSDetect}
          disabled={locating}
          className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-100 transition cursor-pointer"
        >
          <Crosshair className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} />
          <span>{locating ? 'Acquiring GPS...' : 'Use My GPS Location'}</span>
        </button>
      </div>

      <div className="relative w-full h-56 rounded-2xl overflow-hidden border border-neutral-300 shadow-inner z-0">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs flex items-center justify-between">
        <div>
          <span className="text-neutral-500 block text-[11px] font-semibold">Identified Delivery Address:</span>
          <span className="font-bold text-neutral-800">{address}</span>
        </div>
        <div className="text-right">
          <span className="text-neutral-500 block text-[11px] font-semibold">Hub Distance:</span>
          <span className="font-mono font-extrabold text-emerald-700">{distanceKm} km</span>
        </div>
      </div>
    </div>
  );
}
