import './globals.css';
import type { Metadata } from 'next';
import { CartProvider } from '@/context/CartContext';

export const metadata: Metadata = {
  title: 'KlaRetail - Fresh Food & Delivery in Kampala',
  description: 'Fast scheduled grocery & meal delivery across Ntinda, Kiwaatule, Najjera, and Kisaasi.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-stone-50 text-neutral-900 selection:bg-emerald-500 selection:text-white">
        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
