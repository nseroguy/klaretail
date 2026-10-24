'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import { TimeSlot, OrderDeliveryMode, SelectedSlotDetails } from '@/types/slots';

interface DeliverySlotPickerProps {
  vendorId: string;
  onSlotSelect: (details: SelectedSlotDetails) => void;
  vendorOpeningHour?: number; // e.g. 9 for 09:00 EAT
  vendorClosingHour?: number; // e.g. 22 for 22:00 EAT
}

export default function DeliverySlotPicker({
  vendorId,
  onSlotSelect,
  vendorOpeningHour = 8,
  vendorClosingHour = 22,
}: DeliverySlotPickerProps) {
  const [mode, setMode] = useState<OrderDeliveryMode>('asap');
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlotStart, setSelectedSlotStart] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 1. Generate 7-day selection window (Kampala EAT timezone)
  const availableDates = useMemo(() => {
    const dates = [];
    const now = new Date();
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const isoDate = d.toISOString().split('T')[0];
      
      const label = i === 0 
        ? 'Today' 
        : i === 1 
        ? 'Tomorrow' 
        : d.toLocaleDateString('en-UG', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Africa/Kampala' });

      dates.push({ isoDate, label });
    }
    return dates;
  }, []);

  // Initialize with Today
  useEffect(() => {
    if (availableDates.length > 0 && !selectedDate) {
      setSelectedDate(availableDates[0].isoDate);
    }
  }, [availableDates, selectedDate]);

  // 2. Fetch slot availability for vendor + date
  useEffect(() => {
    if (mode !== 'scheduled' || !selectedDate || !vendorId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/slots/available?vendorId=${vendorId}&date=${selectedDate}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load slots');
        return res.json();
      })
      .then((data: { slots: TimeSlot[] }) => {
        if (isMounted) {
          setSlots(data.slots || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [vendorId, selectedDate, mode]);

  // 3. Mode Toggle Handler
  const handleModeChange = (newMode: OrderDeliveryMode) => {
    setMode(newMode);
    if (newMode === 'asap') {
      setSelectedSlotStart(null);
      onSlotSelect({ mode: 'asap' });
    } else {
      if (selectedSlotStart) {
        const slot = slots.find((s) => s.slotStart === selectedSlotStart);
        onSlotSelect({
          mode: 'scheduled',
          slotStart: slot?.slotStart,
          slotEnd: slot?.slotEnd,
        });
      }
    }
  };

  // 4. Slot Selection Handler
  const handleSelectSlot = (slot: TimeSlot) => {
    if (slot.status === 'full' || slot.status === 'closed') return;
    
    // Check 30-minute minimum advance threshold
    const minAdvanceMs = 30 * 60 * 1000;
    const slotTime = new Date(slot.slotStart).getTime();
    if (slotTime < Date.now() + minAdvanceMs) return;

    setSelectedSlotStart(slot.slotStart);
    onSlotSelect({
      mode: 'scheduled',
      slotStart: slot.slotStart,
      slotEnd: slot.slotEnd,
    });
  };

  return (
    <div className="w-full max-w-xl rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
        Delivery Timing
      </h3>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Choose immediate delivery or lock in an exact 15-minute arrival window.
      </p>

      {/* Mode Selector */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleModeChange('asap')}
          className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
            mode === 'asap'
              ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
              : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300'
          }`}
        >
          <span className="text-sm font-semibold">ASAP Delivery</span>
          <span className="text-xs opacity-80">Estimated 30–45 mins</span>
        </button>

        <button
          type="button"
          onClick={() => handleModeChange('scheduled')}
          className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
            mode === 'scheduled'
              ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
              : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300'
          }`}
        >
          <span className="text-sm font-semibold">Schedule Ahead</span>
          <span className="text-xs opacity-80">Pick date & 15-min slot</span>
        </button>
      </div>

      {/* Scheduled Interface */}
      {mode === 'scheduled' && (
        <div className="mt-6 border-t border-neutral-100 pt-5 dark:border-neutral-800">
          {/* 7-Day Date Bar */}
          <label className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Select Delivery Day
          </label>
          <div className="mt-2 flex space-x-2 overflow-x-auto pb-2 scrollbar-none">
            {availableDates.map((item) => (
              <button
                key={item.isoDate}
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setSelectedDate(item.isoDate);
                    setSelectedSlotStart(null);
                  });
                }}
                className={`flex-shrink-0 rounded-lg border px-3.5 py-2 text-center text-xs font-medium transition-colors ${
                  selectedDate === item.isoDate
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Time Slot Matrix */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                15-Minute Windows
              </label>
              <div className="flex items-center space-x-3 text-[11px] text-neutral-500">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Available
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-neutral-300 dark:bg-neutral-700"></span> Full/Past
                </span>
              </div>
            </div>

            {isLoading || isPending ? (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-800"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="mt-3 rounded-md bg-rose-50 p-3 text-xs text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                {error}. Please try selecting another date.
              </div>
            ) : slots.length === 0 ? (
              <p className="mt-3 text-center text-xs text-neutral-500 py-4">
                No operating delivery slots available for this day.
              </p>
            ) : (
              <div className="mt-3 grid max-h-60 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">
                {slots.map((slot) => {
                  const dateObj = new Date(slot.slotStart);
                  const timeLabel = dateObj.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: 'Africa/Kampala',
                  });

                  const isPast = dateObj.getTime() < Date.now() + 30 * 60 * 1000;
                  const isFull = slot.status === 'full' || slot.booked >= slot.capacity;
                  const isDisabled = isPast || isFull || slot.status === 'closed';
                  const isSelected = selectedSlotStart === slot.slotStart;

                  return (
                    <button
                      key={slot.slotStart}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleSelectSlot(slot)}
                      className={`relative flex flex-col items-center justify-center rounded-md border py-2 text-xs font-medium transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm dark:border-emerald-500'
                          : isDisabled
                          ? 'cursor-not-allowed border-neutral-200 bg-neutral-100/60 text-neutral-400 line-through dark:border-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-600'
                          : 'border-neutral-200 bg-white text-neutral-800 hover:border-emerald-500 hover:text-emerald-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      <span>{timeLabel}</span>
                      {isFull && !isPast && (
                        <span className="text-[9px] uppercase tracking-tighter text-rose-500 dark:text-rose-400">
                          Full
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selection Indicator Banner */}
          {selectedSlotStart && (
            <div className="mt-4 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 flex items-center justify-between">
              <span>
                Delivery locked: <strong>{new Date(selectedSlotStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Africa/Kampala' })}</strong> on {selectedDate}
              </span>
              <span className="font-semibold text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Reserved
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}