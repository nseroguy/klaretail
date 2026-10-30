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

    const { wholesalerVendorId, items, deliveryAddress } = await req.json();

    if (!wholesalerVendorId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Wholesaler ID and line items are required' }, { status: 400 });
    }

    // 1. Resolve purchasing retail vendor (supports owner UUID, staff session, explicit vendorId, or slug)
    const sessionUserId = session.id || session.userId || null;
    const sessionPhone = session.phone || null;
    const sessionVendorSlug = session.vendorSlug || null;
    const sessionVendorId = session.vendorId || null;

    const buyerResult: any = await db.execute(sql`
      SELECT v.id, v.name, v.owner_id AS "ownerId"
      FROM vendors v
      LEFT JOIN vendor_staff vs ON vs.vendor_id = v.id
      WHERE (${sessionVendorId}::uuid IS NOT NULL AND v.id = ${sessionVendorId}::uuid)
         OR (${sessionUserId}::uuid IS NOT NULL AND v.owner_id = ${sessionUserId}::uuid)
         OR (${sessionVendorSlug}::text IS NOT NULL AND v.slug = ${sessionVendorSlug}::text)
         OR (${sessionPhone}::text IS NOT NULL AND vs.phone_number = ${sessionPhone}::text)
      LIMIT 1;
    `);

    const buyer = Array.isArray(buyerResult) ? buyerResult[0] : buyerResult?.rows?.[0];
    if (!buyer) {
      return NextResponse.json({ success: false, message: 'Purchasing vendor profile not found' }, { status: 404 });
    }

    // 2. Calculate subtotal & delivery
    let subtotal = 0;
    for (const item of items) {
      subtotal += Number(item.unitPrice) * Number(item.quantity);
    }
    const deliveryFee = 5000;
    const totalAmount = subtotal + deliveryFee;

    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    const handoverPin = Math.floor(1000 + Math.random() * 9000).toString();

    // 3. Atomic Wallet Escrow Debit & PO creation
    const result = await db.transaction(async (tx: any) => {
      // Find wallet belonging to store owner
      const targetUserId = buyer.ownerId || sessionUserId;
      const [wallet]: any = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, targetUserId))
        .for('update');

      if (!wallet || Number(wallet.balance) < totalAmount) {
        throw new Error(
          `Insufficient wallet balance. Total required: UGX ${totalAmount.toLocaleString()}, Available: UGX ${(wallet?.balance || 0).toLocaleString()}`
        );
      }

      const newBalance = Number(wallet.balance) - totalAmount;
      const newHeldFloat = Number(wallet.heldFloat) + totalAmount;

      await tx.update(wallets)
        .set({ balance: newBalance, heldFloat: newHeldFloat })
        .where(eq(wallets.id, wallet.id));

      await tx.insert(walletLedger).values({
        walletId: wallet.id,
        entryType: 'B2B_ESCROW_HOLD',
        amount: -totalAmount,
        balanceAfter: newBalance,
        metadata: {
          poNumber,
          wholesalerVendorId,
          subtotal,
          deliveryFee,
        },
      } as any);

      const poInsert: any = await tx.execute(sql`
        INSERT INTO b2b_purchase_orders (
          order_number, retail_vendor_id, wholesaler_vendor_id,
          status, subtotal, delivery_fee, total_amount,
          payment_terms, payment_status, delivery_address, handover_pin
        ) VALUES (
          ${poNumber}, ${buyer.id}::uuid, ${wholesalerVendorId}::uuid,
          'SUBMITTED', ${subtotal}, ${deliveryFee}, ${totalAmount},
          'PREPAID_WALLET', 'HELD_ESCROW', ${deliveryAddress || 'Store Address'}, ${handoverPin}
        ) RETURNING id, order_number AS "orderNumber", handover_pin AS "handoverPin";
      `);
      const createdPo = Array.isArray(poInsert) ? poInsert[0] : poInsert?.rows?.[0];

      for (const item of items) {
        await tx.execute(sql`
          INSERT INTO b2b_purchase_order_items (
            purchase_order_id, product_id, unit_of_measure, quantity, unit_price, total_price
          ) VALUES (
            ${createdPo.id}::uuid, ${item.productId}::uuid, ${item.unitOfMeasure},
            ${item.quantity}, ${item.unitPrice}, ${item.quantity * item.unitPrice}
          );
        `);
      }

      return { createdPo, remainingBalance: newBalance };
    });

    return NextResponse.json({
      success: true,
      message: `Purchase order ${result.createdPo.orderNumber} successfully issued and escrowed.`,
      orderNumber: result.createdPo.orderNumber,
      handoverPin: result.createdPo.handoverPin,
      remainingBalance: result.remainingBalance,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
}
