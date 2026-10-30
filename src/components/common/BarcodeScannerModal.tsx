"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, X, AlertCircle } from "lucide-react";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
}: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    let stream: MediaStream | null = null;
    let detector: any = null;
    let scanInterval: any = null;

    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e"],
        });
      } catch (e) {
        console.warn("BarcodeDetector formats unsupported:", e);
      }
    }

    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }

        if (detector) {
          scanInterval = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const rawValue = barcodes[0].rawValue;
                if (rawValue) {
                  onScan(rawValue);
                  onClose();
                }
              }
            } catch {
              // frame drop
            }
          }, 250);
        } else {
          setIsSupported(false);
        }
      })
      .catch((err) => {
        setErrorMsg("Camera access denied or unavailable: " + err.message);
      });

    return () => {
      if (scanInterval) clearInterval(scanInterval);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, onScan, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-5 shadow-2xl relative text-center">
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center gap-2 mb-3">
          <Camera className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-white text-sm">Scan Barcode / QR</h3>
        </div>

        {errorMsg ? (
          <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-2xl text-rose-300 text-xs text-left flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-bold">Camera Error</p>
              <p className="mt-1">{errorMsg}</p>
              <p className="mt-2 text-[11px] text-slate-400">
                You can still type the barcode manually or plug in a standard USB/Bluetooth handheld laser scanner.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black border border-slate-800 flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-8 border-2 border-dashed border-emerald-400/80 rounded-2xl pointer-events-none animate-pulse flex items-center justify-center">
                <div className="w-full h-0.5 bg-rose-500 shadow-[0_0_12px_#ef4444]" />
              </div>
            </div>

            {!isSupported && (
              <p className="text-[11px] font-mono text-amber-300 bg-amber-950/40 p-2 rounded-xl border border-amber-800/40">
                Native Web Barcode API not detected on this browser engine. Use an external USB/Bluetooth scanner or enter the barcode value manually.
              </p>
            )}

            <p className="text-[11px] text-slate-400 font-mono">
              Align 1D Barcode (EAN/UPC/SKU) or QR code inside the box.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
