"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LocationPickerProps {
  initialLat?: number;
  initialLng?: number;
  onLocationSelect: (coords: { lat: number; lng: number }) => void;
}

export default function LocationPickerMap({
  initialLat = 0.3136, // Kampala default
  initialLng = 32.5811,
  onLocationSelect,
}: LocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number }>({
    lat: initialLat,
    lng: initialLng,
  });

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const customIcon = L.divIcon({
      className: "custom-delivery-pin",
      html: `<div style="background-color: #059669; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.35);"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 14);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([initialLat, initialLng], {
      icon: customIcon,
      draggable: true,
    }).addTo(map);
    markerRef.current = marker;

    marker.on("dragend", () => {
      const pos = marker.getLatLng();
      const updated = { lat: pos.lat, lng: pos.lng };
      setSelectedCoords(updated);
      onLocationSelect(updated);
    });

    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      const updated = { lat: e.latlng.lat, lng: e.latlng.lng };
      setSelectedCoords(updated);
      onLocationSelect(updated);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const coords = { lat: latitude, lng: longitude };
        setSelectedCoords(coords);
        onLocationSelect(coords);

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 15);
          markerRef.current.setLatLng([latitude, longitude]);
        }
      },
      () => {
        alert("Unable to retrieve GPS. Please tap your location directly on the map.");
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
          Pin Delivery Destination
        </label>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>📍</span> Use My GPS
        </button>
      </div>

      <div
        ref={mapContainerRef}
        className="w-full h-56 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner z-0"
      />

      <div className="flex justify-between items-center text-[11px] text-slate-500 font-mono">
        <span>Latitude: {selectedCoords.lat.toFixed(5)}</span>
        <span>Longitude: {selectedCoords.lng.toFixed(5)}</span>
      </div>
    </div>
  );
}
