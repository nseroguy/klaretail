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

            // 5. Automatic Stock Inwarding to Retail Store Inventory
      const orderItemsRes: any = await tx.execute(sql`
        SELECT poi.quantity, p.name, p.category, p.description, p.image_url, poi.unit_price
        FROM b2b_purchase_order_items poi
        JOIN products p ON poi.product_id = p.id
        WHERE poi.purchase_order_id = cast(${po.id} as uuid);
      `);
      const orderItems = Array.isArray(orderItemsRes) ? orderItemsRes : orderItemsRes?.rows || [];

      for (const item of orderItems) {
        const existingProductRes: any = await tx.execute(sql`
          SELECT id, stock_quantity FROM products
          WHERE vendor_id = cast(${po.retail_vendor_id} as uuid)
            AND LOWER(TRIM(name)) = LOWER(TRIM(${item.name}))
          LIMIT 1;
        `);
        const existingProduct = Array.isArray(existingProductRes) ? existingProductRes[0] : existingProductRes?.rows?.[0];

        if (existingProduct) {
          await tx.execute(sql`
            UPDATE products
            SET stock_quantity = stock_quantity + ${item.quantity},
                is_available = true,
                updated_at = NOW()
            WHERE id = cast(${existingProduct.id} as uuid);
          `);
        } else {
          const suggestedRetailPrice = Math.round(Number(item.unit_price) * 1.25);
          await tx.execute(sql`
            INSERT INTO products (
              id, vendor_id, name, description, category, base_price,
              stock_quantity, track_inventory, is_available, image_url, created_at, updated_at
            ) VALUES (
              gen_random_uuid(),
              cast(${po.retail_vendor_id} as uuid),
              ${item.name},
              ${item.description || 'Restocked via B2B Procurement'},
              ${item.category || 'General'},
              ${suggestedRetailPrice},
              ${item.quantity},
              true,
              true,
              ${item.image_url},
              NOW(),
              NOW()
            );
          `);
        }
      }

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
