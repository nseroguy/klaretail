'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  codAmountDue: number;
  paymentMethod: string;
  deliveryPin: string;
  createdAt: string;
  vendorName: string;
  courierName: string;
}

export default function CustomerOrderHistoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      try {
        const res = await fetch('/api/orders');
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (data.success) {
          setOrders(data.orders || []);
        }
      } catch (err) {
        console.error('Failed to load customer orders:', err);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
        Loading your order history...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-16">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-900/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <h1 className="text-base font-bold text-white">Your Orders</h1>
          <Link
            href="/account"
            className="text-xs text-emerald-400 font-semibold hover:underline"
          >
            Account & Addresses →
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4 space-y-3">
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-xs text-zinc-400 space-y-2">
            <p className="text-xl">🛍️</p>
            <p className="font-semibold text-white">No orders placed yet</p>
            <p>Your ongoing deliveries and order receipts will appear here.</p>
          </div>
        ) : (
          orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm hover:border-zinc-700 transition space-y-2.5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-emerald-400">
                    #{order.orderNumber}
                  </span>
                  <p className="text-xs text-zinc-400 mt-0.5">{order.vendorName}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-bold text-white">
                    UGX {Number(order.totalAmount).toLocaleString()}
                  </span>
                  <p className="text-[10px] uppercase font-semibold text-zinc-400 mt-0.5">
                    {order.paymentMethod}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                  order.status === 'delivered'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                }`}>
                  {order.status}
                </span>

                <div className="flex items-center gap-3">
                  {order.status !== 'delivered' && (
                    <span className="text-[11px] text-zinc-400">
                      Handover PIN: <strong className="font-mono text-white">{order.deliveryPin}</strong>
                    </span>
                  )}
                  <span className="text-zinc-500 text-xs">View Track →</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </main>
    </div>
  );
}
