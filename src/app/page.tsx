'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { 
  Search, 
  ShoppingBag, 
  Plus, 
  Minus, 
  X, 
  Check, 
  ChevronRight, 
  ArrowRight
} from 'lucide-react';

export interface Product {
  id: string;
  name: string;
  category: 'Dairy' | 'Bakery' | 'Poultry' | 'Produce' | 'Beverages' | 'Pantry';
  unit: string;
  price: number;
  image: string;
  inStock: boolean;
}

export const PRODUCTS: Product[] = [
  {
    id: 'prod_milk',
    name: 'Fresh Farm Milk',
    category: 'Dairy',
    unit: '1 Liter',
    price: 4500,
    image: '🥛',
    inStock: true,
  },
  {
    id: 'prod_bread',
    name: 'Kampala Baker Loaf',
    category: 'Bakery',
    unit: '800g',
    price: 5500,
    image: '🍞',
    inStock: true,
  },
  {
    id: 'prod_eggs',
    name: 'Local Farm Eggs (Tray)',
    category: 'Poultry',
    unit: 'Tray of 30',
    price: 14000,
    image: '🥚',
    inStock: true,
  },
  {
    id: 'prod_bananas',
    name: 'Organic Bananas (Bogoya)',
    category: 'Produce',
    unit: 'Cluster (~1.5kg)',
    price: 6000,
    image: '🍌',
    inStock: true,
  },
  {
    id: 'prod_avocado',
    name: 'Hass Avocados',
    category: 'Produce',
    unit: 'Pack of 3',
    price: 5000,
    image: '🥑',
    inStock: true,
  },
  {
    id: 'prod_onions',
    name: 'Red Onion Net',
    category: 'Produce',
    unit: '1 kg Net',
    price: 7500,
    image: '🧅',
    inStock: true,
  },
  {
    id: 'prod_coffee',
    name: 'Arabica Roast Coffee',
    category: 'Beverages',
    unit: '250g Ground',
    price: 18000,
    image: '☕',
    inStock: true,
  },
  {
    id: 'prod_honey',
    name: 'Pure Clover Honey',
    category: 'Pantry',
    unit: '500g Jar',
    price: 16000,
    image: '🍯',
    inStock: true,
  },
];

const CATEGORIES = ['All', 'Dairy', 'Bakery', 'Poultry', 'Produce', 'Beverages', 'Pantry'] as const;

export default function StorefrontPage() {
  const { items, addToCart, removeFromCart, updateQuantity, subtotal, clearCart } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  // Derive totalItems from items array
  const totalItems = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }, [items]);

  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter((p) => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            p.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const getItemQuantity = (productId: string) => {
    const item = items.find((i) => i.id === productId);
    return item ? item.quantity : 0;
  };

  return (
    <div className="min-h-screen bg-[#0C0F0E] text-[#ECEEEB] flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-300">
      
      {/* Top Header */}
      <header className="border-b border-[#1C221F] bg-[#0C0F0E]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-xl text-white">KlaRetail Express</span>
              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Kampala Central Fast Sm Courier Matching
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 font-medium">Good food. Close to home.</p>
          </div>

          {/* Search Input */}
          <div className="flex-1 max-w-xs relative hidden md:block">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search your essentials"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#141A17] border border-[#212A25] rounded-full pl-9 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/60 transition"
            />
          </div>

          {/* Top Cart Pill */}
          <button
            onClick={() => setCartDrawerOpen(true)}
            className="flex items-center gap-2.5 px-4 py-2 bg-[#161D19] hover:bg-[#1E2722] border border-[#232D27] rounded-full text-xs font-bold text-white transition active:scale-95 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <span>Cart</span>
            {totalItems > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-neutral-950 font-black text-[11px]">
                {totalItems}
              </span>
            )}
          </button>
        </div>

        {/* Category Filters Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 pt-1 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#00D084] text-[#0C0F0E] font-bold shadow-sm'
                      : 'bg-[#151B18] text-neutral-400 hover:text-white hover:bg-[#1C2520] border border-[#202924]'
                  }`}
                >
                  {cat} {cat === 'All' && `(${PRODUCTS.length})`}
                </button>
              );
            })}
          </div>
          <span className="text-[11px] text-neutral-500 font-mono hidden sm:inline whitespace-nowrap">
            {PRODUCTS.length} essentials · All in stock
          </span>
        </div>
      </header>

      {/* Main Catalog Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">The market</h1>
            <p className="text-xs text-neutral-400">Fresh picks for your everyday routine</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Live Dispatch Active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filteredProducts.map((p) => {
            const qty = getItemQuantity(p.id);
            const inCart = qty > 0;

            return (
              <div
                key={p.id}
                className="bg-[#121614] border border-[#1E2521] hover:border-emerald-600/40 rounded-2xl p-4 flex flex-col justify-between transition group shadow-sm"
              >
                <div>
                  {/* Top indicators */}
                  <div className="flex items-center justify-between mb-3 min-h-[22px]">
                    {inCart ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                        <Check className="w-3 h-3 stroke-[3]" />
                        IN YOUR CART
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                        {p.category}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      In stock
                    </span>
                  </div>

                  {/* Product Visual Mock */}
                  <div className="h-32 bg-[#171D1A] rounded-xl flex items-center justify-center text-5xl mb-4 group-hover:scale-102 transition">
                    {p.image}
                  </div>

                  {/* Product Details */}
                  <h3 className="font-bold text-sm text-white">{p.name}</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">{p.unit}</p>
                </div>

                {/* Price and Cart Actions */}
                <div className="mt-5 pt-3 border-t border-[#1C231F] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-neutral-500 uppercase block">UGX</span>
                    <span className="text-sm font-extrabold text-white font-mono">
                      {p.price.toLocaleString()}
                    </span>
                  </div>

                  {inCart ? (
                    <div className="flex items-center bg-[#171E1A] border border-[#232D26] rounded-xl p-1 gap-2">
                      <button
                        onClick={() => updateQuantity(p.id, qty - 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#202923] hover:bg-[#2A362E] text-white transition active:scale-90"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-mono font-bold text-white px-1">
                        {qty}
                      </span>
                      <button
                        onClick={() => updateQuantity(p.id, qty + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#202923] hover:bg-[#2A362E] text-white transition active:scale-90"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart({ id: p.id, name: p.name, price: p.price, quantity: 1 })}
                      className="px-3.5 py-2 bg-[#00D084] hover:bg-[#00BA76] text-[#0C0F0E] font-bold text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      Add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Floating Bottom Cart Bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-40">
          <div className="bg-[#121714]/95 border border-[#232C26] backdrop-blur-lg p-3 px-5 rounded-2xl shadow-2xl flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400 font-medium">Your cart</span>
                <span className="w-1 h-1 rounded-full bg-neutral-600"></span>
                <span className="text-xs text-neutral-400">{totalItems} {totalItems === 1 ? 'item' : 'items'}</span>
              </div>
              <div className="text-sm font-extrabold text-white font-mono mt-0.5">
                UGX {subtotal.toLocaleString()}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setCartDrawerOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1A221E] hover:bg-[#232C26] text-white border border-[#2B3630] transition"
              >
                View Cart
              </button>
              <Link
                href="/checkout"
                className="px-4 py-2 rounded-xl text-xs font-black bg-[#00D084] hover:bg-[#00BA76] text-[#0C0F0E] flex items-center gap-1.5 transition shadow-sm"
              >
                <span>Checkout</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer Modal */}
      {cartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition" 
            onClick={() => setCartDrawerOpen(false)}
          />

          {/* Drawer Body */}
          <div className="relative w-full max-w-md bg-[#111513] border-l border-[#1F2723] h-full flex flex-col z-10 shadow-2xl">
            {/* Header */}
            <div className="p-5 border-b border-[#1C231F] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Your Shopping Cart</h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {totalItems} items in your basket · {items.length} products
                </p>
              </div>
              <button
                onClick={() => setCartDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-[#171D1A] border border-[#242E28] flex items-center justify-center text-neutral-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <ShoppingBag className="w-12 h-12 text-neutral-600 mb-3" />
                  <p className="text-sm font-semibold text-neutral-300">Your basket is empty</p>
                  <p className="text-xs text-neutral-500 mt-1">Add items from the market catalog to start your delivery.</p>
                </div>
              ) : (
                items.map((it) => {
                  const productInfo = PRODUCTS.find((p) => p.id === it.id);
                  return (
                    <div
                      key={it.id}
                      className="bg-[#151B17] border border-[#202823] rounded-2xl p-3.5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{productInfo?.image || '📦'}</span>
                        <div>
                          <h4 className="text-xs font-bold text-white">{it.name}</h4>
                          <span className="text-[11px] text-neutral-400 block">{productInfo?.unit || ''}</span>
                          <span className="text-[11px] text-neutral-500 font-mono">
                            UGX {it.price.toLocaleString()} each
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs font-extrabold text-white font-mono">
                          UGX {(it.price * it.quantity).toLocaleString()}
                        </span>
                        <div className="flex items-center bg-[#1B221E] border border-[#26312A] rounded-lg p-0.5 gap-1.5">
                          <button
                            onClick={() => updateQuantity(it.id, it.quantity - 1)}
                            className="w-6 h-6 flex items-center justify-center rounded bg-[#232C26] text-white hover:bg-[#2C3730] transition"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-mono font-bold text-white px-1">
                            {it.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(it.id, it.quantity + 1)}
                            className="w-6 h-6 flex items-center justify-center rounded bg-[#232C26] text-white hover:bg-[#2C3730] transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Summary & Proceed */}
            {items.length > 0 && (
              <div className="p-5 border-t border-[#1C231F] bg-[#0E1210] space-y-4">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <button
                    onClick={() => {
                      if (typeof clearCart === 'function') clearCart();
                      else items.forEach((it) => removeFromCart(it.id));
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 transition underline underline-offset-4 cursor-pointer"
                  >
                    Clear cart
                  </button>
                  <div className="text-right">
                    <span className="text-neutral-400 mr-2">Cart Subtotal:</span>
                    <span className="text-base font-extrabold text-white font-mono">
                      UGX {subtotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                <Link
                  href="/checkout"
                  onClick={() => setCartDrawerOpen(false)}
                  className="w-full py-3.5 bg-[#00D084] hover:bg-[#00BA76] text-[#0C0F0E] font-black text-xs rounded-xl flex items-center justify-center gap-2 transition active:scale-98 shadow-sm"
                >
                  <span>Proceed to Checkout</span>
                  <ChevronRight className="w-4 h-4 stroke-[3]" />
                </Link>

                <button
                  type="button"
                  onClick={() => setCartDrawerOpen(false)}
                  className="w-full text-center text-xs text-neutral-400 hover:text-white transition"
                >
                  Continue shopping
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#181F1B] py-6 px-4 text-center text-[11px] text-neutral-500 font-mono">
        KlaRetail Express · Automated Edge Dispatch System · Kampala, Uganda
      </footer>
    </div>
  );
}
