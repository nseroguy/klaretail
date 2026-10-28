"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Flame,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  UtensilsCrossed,
  Bike,
  Store,
  RefreshCw,
  Volume2,
  VolumeX,
} from "lucide-react";

export type FulfillmentType = "delivery" | "dine_in" | "walk_in" | "pickup";
export type PrepStatus = "accepted" | "preparing" | "ready_for_pickup";

export interface SelectedModifier {
  groupName: string;
  optionName: string;
  priceDelta: number;
}

export interface KDSTicketItem {
  id: string;
  name: string;
  quantity: number;
  selectedModifiers?: SelectedModifier[];
  kitchenNotes?: string | null;
}

export interface KDSTicket {
  id: string;
  orderNumber: string;
  fulfillmentType: FulfillmentType;
  status: PrepStatus;
  tableNumber?: string | null;
  guestCount?: number | null;
  waiterName?: string | null;
  items: KDSTicketItem[];
  createdAt: string;
}

export default function KitchenDisplaySystemPage() {
  const [tickets, setTickets] = useState<KDSTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | FulfillmentType>("all");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/vendor/kds/tickets");
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
        setLastRefreshed(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("KDS sync failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 8000);
    return () => clearInterval(interval);
  }, [fetchTickets]);

  const updateTicketStatus = async (orderId: string, nextStatus: PrepStatus | "dispatched") => {
    setActionInProgress(orderId);
    try {
      const res = await fetch("/api/vendor/kds/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: nextStatus }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to update ticket.");
      }

      if (nextStatus === "ready_for_pickup" || nextStatus === "dispatched") {
        setTickets((prev) => prev.filter((t) => t.id !== orderId));
      } else {
        setTickets((prev) =>
          prev.map((t) => (t.id === orderId ? { ...t, status: nextStatus } : t))
        );
      }
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const getElapsedMinutes = (createdAt: string) => {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  const getUrgencyStyles = (minutes: number) => {
    if (minutes >= 20) {
      return {
        border: "border-rose-500 shadow-rose-950/40 shadow-lg",
        badge: "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse",
        header: "bg-rose-950/40",
      };
    }
    if (minutes >= 12) {
      return {
        border: "border-amber-500 shadow-amber-950/30 shadow-md",
        badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
        header: "bg-amber-950/30",
      };
    }
    return {
      border: "border-slate-800",
      badge: "bg-slate-800 text-slate-300 border-slate-700",
      header: "bg-[#161b26]",
    };
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (filterType === "all") return true;
      return ticket.fulfillmentType === filterType;
    });
  }, [tickets, filterType]);

  const counts = useMemo(() => {
    return {
      all: tickets.length,
      dine_in: tickets.filter((t) => t.fulfillmentType === "dine_in").length,
      delivery: tickets.filter((t) => t.fulfillmentType === "delivery").length,
      walk_in: tickets.filter((t) => t.fulfillmentType === "walk_in").length,
    };
  }, [tickets]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#0b0e14] text-slate-100 font-sans select-none overflow-hidden">
      <header className="h-16 px-6 bg-[#111622] border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center">
            <Flame className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              KITCHEN DISPLAY SYSTEM
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                LIVE
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Bourbon Pizza Wandegeya • Oven & Assembly Line
            </p>
          </div>
        </div>

        <div className="flex items-center bg-[#0b0e14] p-1 rounded-xl border border-slate-800 font-mono text-xs">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg transition ${
              filterType === "all"
                ? "bg-slate-800 text-white font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All Tickets ({counts.all})
          </button>
          <button
            onClick={() => setFilterType("dine_in")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              filterType === "dine_in"
                ? "bg-purple-950/60 text-purple-300 border border-purple-800/60 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            Dine-In ({counts.dine_in})
          </button>
          <button
            onClick={() => setFilterType("delivery")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              filterType === "delivery"
                ? "bg-blue-950/60 text-blue-300 border border-blue-800/60 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            Delivery ({counts.delivery})
          </button>
          <button
            onClick={() => setFilterType("walk_in")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              filterType === "walk_in"
                ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 font-bold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            Takeaway ({counts.walk_in})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border transition ${
              soundEnabled
                ? "bg-slate-800/80 border-slate-700 text-emerald-400"
                : "bg-slate-900 border-slate-800 text-slate-500"
            }`}
            title={soundEnabled ? "Sound Alerts Active" : "Sound Muted"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={fetchTickets}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white transition"
            title="Force Sync"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <div className="text-right hidden sm:block font-mono text-[11px] text-slate-500">
            <div>Synced: {lastRefreshed || "--:--:--"}</div>
            <div>{tickets.length} Active Orders</div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-5 overflow-x-auto overflow-y-hidden bg-[#0b0e14]">
        {filteredTickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-3">
            <CheckCircle2 className="w-14 h-14 text-emerald-500/40" />
            <div className="text-lg font-bold text-slate-400 font-mono">ALL TICKETS CLEARED</div>
            <p className="text-xs text-slate-600 font-mono">Kitchen queue is currently empty.</p>
          </div>
        ) : (
          <div className="flex gap-4 h-full items-start overflow-x-auto pb-4">
            {filteredTickets.map((ticket) => {
              const minutesElapsed = getElapsedMinutes(ticket.createdAt);
              const urgency = getUrgencyStyles(minutesElapsed);
              const isBusy = actionInProgress === ticket.id;

              return (
                <div
                  key={ticket.id}
                  className={`w-[340px] shrink-0 max-h-full flex flex-col rounded-2xl bg-[#121620] border ${urgency.border} transition-all duration-200 overflow-hidden`}
                >
                  <div className={`p-3.5 border-b border-slate-800 ${urgency.header} flex flex-col gap-2`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-white tracking-wide">
                          {ticket.orderNumber}
                        </span>
                        {ticket.fulfillmentType === "dine_in" && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-semibold flex items-center gap-1">
                            <UtensilsCrossed className="w-2.5 h-2.5" />
                            TABLE {ticket.tableNumber || "?"}
                          </span>
                        )}
                        {ticket.fulfillmentType === "delivery" && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-mono font-semibold flex items-center gap-1">
                            <Bike className="w-2.5 h-2.5" />
                            DELIVERY
                          </span>
                        )}
                        {ticket.fulfillmentType === "walk_in" && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-semibold flex items-center gap-1">
                            <Store className="w-2.5 h-2.5" />
                            TAKEAWAY
                          </span>
                        )}
                      </div>

                      <div
                        className={`px-2 py-1 rounded-lg border text-xs font-mono font-bold flex items-center gap-1 ${urgency.badge}`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{minutesElapsed}m</span>
                      </div>
                    </div>

                    {ticket.fulfillmentType === "dine_in" && (
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span>Guests: {ticket.guestCount || 1}</span>
                        <span>Server: {ticket.waiterName || "Counter"}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 p-3.5 space-y-3 overflow-y-auto font-mono text-sm">
                    {ticket.items.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="pb-3 border-b border-slate-800/80 last:border-0 last:pb-0"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-100 flex items-start gap-1.5">
                            <span className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center text-xs text-orange-400 font-bold shrink-0">
                              {item.quantity}
                            </span>
                            <span className="leading-tight">{item.name}</span>
                          </span>
                        </div>

                        {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                          <div className="mt-1.5 pl-6 space-y-0.5">
                            {item.selectedModifiers.map((mod, mIdx) => (
                              <div
                                key={mIdx}
                                className="text-xs text-amber-300/90 flex items-center gap-1"
                              >
                                <span className="text-[10px] text-slate-500">•</span>
                                <span className="font-semibold">{mod.optionName}</span>
                                {mod.priceDelta > 0 && (
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    (+{mod.priceDelta.toLocaleString()})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {item.kitchenNotes && (
                          <div className="mt-1.5 pl-6 text-xs text-rose-300 italic flex items-center gap-1 bg-rose-950/20 p-1.5 rounded border border-rose-900/40">
                            <AlertTriangle className="w-3 h-3 shrink-0 text-rose-400" />
                            <span>{item.kitchenNotes}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-[#0d1017] border-t border-slate-800 flex gap-2">
                    {ticket.status === "accepted" ? (
                      <button
                        onClick={() => updateTicketStatus(ticket.id, "preparing")}
                        disabled={isBusy}
                        className="flex-1 py-3 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-xs tracking-wider transition flex items-center justify-center gap-1.5 font-mono shadow-md shadow-amber-950"
                      >
                        <Flame className="w-4 h-4" />
                        <span>{isBusy ? "UPDATING..." : "START PREP (IN OVEN)"}</span>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => updateTicketStatus(ticket.id, "accepted")}
                          disabled={isBusy}
                          className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                          title="Revert to Queued"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => updateTicketStatus(ticket.id, "ready_for_pickup")}
                          disabled={isBusy}
                          className="flex-1 py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-xs tracking-wider transition flex items-center justify-center gap-1.5 font-mono shadow-md shadow-emerald-950"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {isBusy
                              ? "FINALIZING..."
                              : ticket.fulfillmentType === "dine_in"
                              ? "ORDER READY (SERVE TABLE)"
                              : "READY FOR PICKUP / COURIER"}
                          </span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
