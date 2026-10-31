import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import {
  b2bPurchaseOrders,
  b2bPurchaseOrderItems,
  vendorCreditFacilities,
  creditTranches,
  wallets,
  walletLedger,
  vendors,
} from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawCookie =
      req.cookies.get('super_admin_session')?.value ||
      req.cookies.get('staff_session')?.value ||
      req.cookies.get('session_token')?.value ||
      req.cookies.get('klaretail_session')?.value;

    let session: any = null;
    if (rawCookie) {
      try {
        let dec = rawCookie;
        while (dec.includes('%')) dec = decodeURIComponent(dec);
        session = JSON.parse(dec);
      } catch {
        try {
          let b64 = rawCookie;
          while (b64.includes('%')) b64 = decodeURIComponent(b64);
          session = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
        } catch {
          session = null;
        }
      }
    }

    const body = await req.json().catch(() => ({}));
    const {
      wholesalerVendorId,
      items,
      deliveryAddress,
      paymentTerms = 'PREPAID_WALLET',
      retailVendorId: bodyRetailVendorId,
    } = body;

    if (!wholesalerVendorId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Wholesaler ID and line items are required' },
        { status: 400 }
      );
    }

    // 1. Resolve purchasing retail vendor
    const sessionUserId = session?.id || session?.userId || null;
    const sessionPhone = session?.phone || null;
    const sessionVendorSlug = session?.vendorSlug || null;
    const sessionVendorId = session?.vendorId || bodyRetailVendorId || null;

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
      subtotal += Number(item.unitPrice || 0) * Number(item.quantity || 1);
    }
    const deliveryFee = 5000;
    const totalAmount = subtotal + deliveryFee;

    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    const handoverPin = Math.floor(1000 + Math.random() * 9000).toString();
    const isCreditFinancing = paymentTerms === 'credit_financing' || paymentTerms === 'SNPL';

    // 3. Handle SNPL Credit Line
    if (isCreditFinancing) {
      const facilityRows: any = await db.execute(sql`
        SELECT id, credit_limit, available_credit, drawn_amount, interest_rate_bps, max_tenor_days, status
        FROM vendor_credit_facilities
        WHERE vendor_id = ${buyer.id}::uuid
        LIMIT 1;
      `);

      const facility = Array.isArray(facilityRows) ? facilityRows[0] : facilityRows?.rows?.[0];
      if (!facility || facility.status !== 'active') {
        return NextResponse.json(
          { success: false, message: 'Credit line is currently inactive or unapproved.' },
          { status: 400 }
        );
      }

      if (Number(facility.available_credit) < totalAmount) {
        return NextResponse.json(
          {
            success: false,
            message: `Insufficient credit limit. Required: UGX ${totalAmount.toLocaleString()}, Available: UGX ${Number(facility.available_credit).toLocaleString()}`,
          },
          { status: 400 }
        );
      }

      const feeAmount = Math.round(totalAmount * (Number(facility.interest_rate_bps || 250) / 10000));
      const totalDue = totalAmount + feeAmount;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + Number(facility.max_tenor_days || 14));

      const result = await db.transaction(async (tx: any) => {
        const [createdPo]: any = await tx
          .insert(b2bPurchaseOrders)
          .values({
            orderNumber: poNumber,
            retailVendorId: buyer.id,
            wholesalerVendorId,
            status: 'SUBMITTED',
            subtotal,
            deliveryFee,
            totalAmount,
            paymentTerms: 'SNPL',
            paymentStatus: 'HELD_ESCROW',
            deliveryAddress: deliveryAddress || 'Store Address',
            handoverPin,
          })
          .returning();

        for (const item of items) {
          await tx.insert(b2bPurchaseOrderItems).values({
            purchaseOrderId: createdPo.id,
            productId: item.productId,
            unitOfMeasure: item.unitOfMeasure || 'units',
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            totalPrice: Number(item.quantity || 1) * Number(item.unitPrice || 0),
          });
        }

        // Record loan tranche
        await tx.insert(creditTranches).values({
          facilityId: facility.id,
          vendorId: buyer.id,
          b2bOrderId: createdPo.id,
          principalAmount: String(totalAmount),
          feeAmount: String(feeAmount),
          totalDue: String(totalDue),
          dueDate,
          status: 'active',
        });

        // Decrement available credit
        await tx.execute(sql`
          UPDATE vendor_credit_facilities
          SET available_credit = available_credit - ${totalAmount},
              drawn_amount = drawn_amount + ${totalAmount}
          WHERE id = ${facility.id}::uuid;
        `);

        return createdPo;
      });

      return NextResponse.json({
        success: true,
        message: `Purchase order ${result.orderNumber} successfully issued via SNPL credit line.`,
        orderNumber: result.orderNumber,
        handoverPin: result.handoverPin,
      });
    }

    // 4. Default Wallet Debit Flow
    const result = await db.transaction(async (tx: any) => {
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

      const [createdPo]: any = await tx
        .insert(b2bPurchaseOrders)
        .values({
          orderNumber: poNumber,
          retailVendorId: buyer.id,
          wholesalerVendorId,
          status: 'SUBMITTED',
          subtotal,
          deliveryFee,
          totalAmount,
          paymentTerms: 'PREPAID_WALLET',
          paymentStatus: 'HELD_ESCROW',
          deliveryAddress: deliveryAddress || 'Store Address',
          handoverPin,
        })
        .returning();

      for (const item of items) {
        await tx.insert(b2bPurchaseOrderItems).values({
          purchaseOrderId: createdPo.id,
          productId: item.productId,
          unitOfMeasure: item.unitOfMeasure || 'units',
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unitPrice || 0),
          totalPrice: Number(item.quantity || 1) * Number(item.unitPrice || 0),
        });
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
    console.error('[B2B ORDER ERROR]', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to place purchase order' }, { status: 400 });
  }
}
