import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { wallets, walletLedger } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawCookie = req.cookies.get('staff_session')?.value || req.cookies.get('session_token')?.value;
    if (!rawCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Session missing.' }, { status: 401 });
    }

    let session: any;
    try {
      let dec = rawCookie;
      while (dec.includes('%')) dec = decodeURIComponent(dec);
      session = JSON.parse(dec);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid session' }, { status: 401 });
    }

    const { orderNumber, handoverPin } = await req.json();

    if (!orderNumber || !handoverPin) {
      return NextResponse.json({ success: false, message: 'Order number and handover PIN are required' }, { status: 400 });
    }

    const result = await db.transaction(async (tx: any) => {
      // 1. Fetch Purchase Order
      const poRes: any = await tx.execute(sql`
        SELECT po.*, v_retail.owner_id AS "buyerOwnerId", v_wholesaler.owner_id AS "wholesalerOwnerId"
        FROM b2b_purchase_orders po
        JOIN vendors v_retail ON po.retail_vendor_id = v_retail.id
        JOIN vendors v_wholesaler ON po.wholesaler_vendor_id = v_wholesaler.id
        WHERE po.order_number = ${orderNumber}
        FOR UPDATE;
      `);
      const po = Array.isArray(poRes) ? poRes[0] : poRes?.rows?.[0];

      if (!po) throw new Error('Purchase order not found');
      if (po.status === 'DELIVERED_AND_RECEIVED') throw new Error('Purchase order already fulfilled and settled');
      if (po.handover_pin !== String(handoverPin).trim()) throw new Error('Invalid handover PIN');

      // 2. Release Escrow from Buyer
      const [buyerWallet]: any = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, po.buyerOwnerId))
        .for('update');

      if (buyerWallet) {
        await tx.update(wallets)
          .set({ heldFloat: sql`held_float - ${po.total_amount}` })
          .where(eq(wallets.id, buyerWallet.id));

        await tx.insert(walletLedger).values({
          walletId: buyerWallet.id,
          entryType: 'B2B_PURCHASE_DEBIT',
          amount: 0,
          balanceAfter: buyerWallet.balance,
          metadata: { poNumber: po.order_number, status: 'DELIVERED' },
        } as any);
      }

      // 3. Credit Wholesaler Wallet (2% platform commission)
      const platformFee = Math.round(Number(po.subtotal) * 0.02);
      const netWholesalerPayout = Number(po.total_amount) - platformFee;

      const [wholesalerWallet]: any = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, po.wholesalerOwnerId))
        .for('update');

      if (wholesalerWallet) {
        const newWholesaleBalance = Number(wholesalerWallet.balance) + netWholesalerPayout;
        await tx.update(wallets)
          .set({ balance: newWholesaleBalance })
          .where(eq(wallets.id, wholesalerWallet.id));

        await tx.insert(walletLedger).values({
          walletId: wholesalerWallet.id,
          entryType: 'B2B_SALE_CREDIT',
          amount: netWholesalerPayout,
          balanceAfter: newWholesaleBalance,
          metadata: {
            poNumber: po.order_number,
            grossTotal: po.total_amount,
            platformCommission: platformFee,
          },
        } as any);
      }

      // 4. Update PO Status
      await tx.execute(sql`
        UPDATE b2b_purchase_orders
        SET status = 'DELIVERED_AND_RECEIVED',
            payment_status = 'SETTLED',
            updated_at = NOW()
        WHERE id = ${po.id}::uuid;
      `);

      // 5. Automatic Stock Inwarding to Retail Inventory
      await tx.execute(sql`
        UPDATE products p
        SET stock_quantity = p.stock_quantity + poi.quantity
        FROM b2b_purchase_order_items poi
        WHERE poi.purchase_order_id = ${po.id}::uuid
          AND p.id = poi.product_id;
      `);

      return {
        orderNumber: po.order_number,
        netWholesalerPayout,
        platformFee,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Purchase order ${result.orderNumber} successfully received. Stock updated and funds disbursed to wholesaler.`,
      settlement: result,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
}
