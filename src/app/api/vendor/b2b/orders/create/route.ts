import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import {
  b2bPurchaseOrders,
  b2bPurchaseOrderItems,
  vendorCreditFacilities,
  creditTranches,
  wallets,
  walletLedger,
  vendors,
} from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawCookie =
      request.cookies.get('super_admin_session')?.value ||
      request.cookies.get('staff_session')?.value ||
      request.cookies.get('session_token')?.value ||
      request.cookies.get('klaretail_session')?.value;

    let sessionVendorId: string | null = null;
    if (rawCookie) {
      try {
        let decoded = rawCookie;
        while (decoded.includes('%')) {
          decoded = decodeURIComponent(decoded);
        }
        const parsed = JSON.parse(decoded);
        sessionVendorId = parsed.vendorId || parsed.id || null;
      } catch {
        try {
          let b64 = rawCookie;
          while (b64.includes('%')) {
            b64 = decodeURIComponent(b64);
          }
          const parsed = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
          sessionVendorId = parsed.vendorId || parsed.id || null;
        } catch {
          sessionVendorId = null;
        }
      }
    }

    const body = await request.json().catch(() => ({}));
    const {
      retailVendorId: bodyRetailVendorId,
      wholesalerVendorId,
      items,
      deliveryAddress,
      paymentTerms = 'PREPAID_WALLET',
    } = body;

    const retailVendorId = sessionVendorId || bodyRetailVendorId;

    if (!retailVendorId) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Vendor session missing.' },
        { status: 401 }
      );
    }

    if (!wholesalerVendorId) {
      return NextResponse.json(
        { success: false, message: 'Missing wholesalerVendorId.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Order must contain at least one item.' },
        { status: 400 }
      );
    }

    // 1. Calculate total amounts
    let subtotal = 0;
    const preparedItems = items.map((item: any) => {
      const qty = Number(item.quantity) || 1;
      const unitPrice = Number(item.unitPrice || item.price) || 0;
      const totalPrice = qty * unitPrice;
      subtotal += totalPrice;
      return {
        productId: item.productId,
        unitOfMeasure: item.unitOfMeasure || 'units',
        quantity: qty,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
      };
    });

    const deliveryFee = Number(body.deliveryFee) || 0;
    const totalAmount = subtotal + deliveryFee;
    const orderNumber = `B2B-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const handoverPin = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Validate Credit Facility if Credit Financing / SNPL is selected
    const isCreditFinancing = paymentTerms === 'credit_financing' || paymentTerms === 'SNPL';
    let activeFacility: any = null;

    if (isCreditFinancing) {
      const facilities: any = await db.execute(sql`
        SELECT id, credit_limit, available_credit, drawn_amount, interest_rate_bps, max_tenor_days, status
        FROM vendor_credit_facilities
        WHERE vendor_id = ${retailVendorId}::uuid
        LIMIT 1;
      `);

      activeFacility = Array.isArray(facilities) ? facilities[0] : facilities?.rows?.[0];

      if (!activeFacility || activeFacility.status !== 'active') {
        return NextResponse.json(
          { success: false, message: 'Working capital credit facility is not active or approved for this store.' },
          { status: 400 }
        );
      }

      if (Number(activeFacility.available_credit) < totalAmount) {
        return NextResponse.json(
          {
            success: false,
            message: `Insufficient credit limit. Required: UGX ${totalAmount.toLocaleString()}, Available: UGX ${Number(activeFacility.available_credit).toLocaleString()}`,
          },
          { status: 400 }
        );
      }
    }

    // 3. Execute Transaction
    const result = await db.transaction(async (tx) => {
      // Create B2B Purchase Order
      const [order]: any = await tx
        .insert(b2bPurchaseOrders)
        .values({
          orderNumber,
          retailVendorId,
          wholesalerVendorId,
          status: 'SUBMITTED',
          subtotal,
          deliveryFee,
          totalAmount,
          paymentTerms: isCreditFinancing ? 'SNPL' : paymentTerms,
          paymentStatus: isCreditFinancing ? 'HELD_ESCROW' : 'PENDING',
          deliveryAddress: deliveryAddress || 'Store Location',
          handoverPin,
        })
        .returning();

      // Create Order Items
      for (const item of preparedItems) {
        await tx.insert(b2bPurchaseOrderItems).values({
          purchaseOrderId: order.id,
          productId: item.productId,
          unitOfMeasure: item.unitOfMeasure,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        });
      }

      // If Credit Financing: Open Tranche, Deduct Available Credit, Settle Wholesaler Float
      if (isCreditFinancing && activeFacility) {
        const feeAmount = Math.round(totalAmount * (Number(activeFacility.interest_rate_bps) / 10000));
        const totalDue = totalAmount + feeAmount;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + Number(activeFacility.max_tenor_days || 14));

        // Insert Credit Tranche
        await tx.insert(creditTranches).values({
          facilityId: activeFacility.id,
          vendorId: retailVendorId,
          b2bOrderId: order.id,
          principalAmount: String(totalAmount),
          feeAmount: String(feeAmount),
          totalDue: String(totalDue),
          dueDate: dueDate,
          status: 'active',
        });

        // Decrement available credit on facility
        await tx.execute(sql`
          UPDATE vendor_credit_facilities
          SET available_credit = available_credit - ${totalAmount},
              drawn_amount = drawn_amount + ${totalAmount}
          WHERE id = ${activeFacility.id}::uuid;
        `);

        // Find wholesaler owner user wallet
        const [wholesalerOwner]: any = await tx
          .select({ ownerId: vendors.ownerId })
          .from(vendors)
          .where(sql`${vendors.id} = ${wholesalerVendorId}::uuid`)
          .limit(1);

        if (wholesalerOwner?.ownerId) {
          const [wholesalerWallet]: any = await tx
            .select()
            .from(wallets)
            .where(sql`${wallets.userId} = ${wholesalerOwner.ownerId}::uuid`)
            .limit(1);

          if (wholesalerWallet) {
            const currentBal = Number(wholesalerWallet.balance || 0);
            const newBal = currentBal + totalAmount;

            await tx.execute(sql`
              UPDATE wallets
              SET balance = ${newBal}
              WHERE id = ${wholesalerWallet.id}::uuid;
            `);

            await tx.execute(sql`
              INSERT INTO wallet_ledger (id, wallet_id, entry_type, amount, balance_after, metadata, created_at)
              VALUES (
                gen_random_uuid(),
                ${wholesalerWallet.id}::uuid,
                'platform_delivery_share',
                ${totalAmount},
                ${newBal},
                ${JSON.stringify({ note: `Settlement for B2B procurement ${orderNumber} via SNPL credit line` })},
                NOW()
              );
            `);
          }
        }
      }

      return order;
    });

    return NextResponse.json({
      success: true,
      message: isCreditFinancing
        ? 'B2B order placed successfully with Stock Now Pay Later (SNPL) financing.'
        : 'B2B order placed successfully.',
      order: result,
    });
  } catch (error: any) {
    console.error('[B2B ORDER CREATE ERROR]', error);
    return NextResponse.json({ success: false, message: error.message || 'Server error' }, { status: 500 });
  }
}
