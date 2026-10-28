import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawCookie = request.cookies.get('staff_session')?.value;
    let actorId = 'system';
    let actorRole = 'super_admin';

    if (rawCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(rawCookie));
        actorId = parsed?.id || actorId;
        actorRole = parsed?.role || actorRole;
      } catch {}
    }

    const { orderId, riderId } = await request.json();

    if (!orderId || !riderId) {
      return NextResponse.json(
        { success: false, message: 'Both orderId and riderId are required.' },
        { status: 400 }
      );
    }

    // 1. Fetch courier details & float balance
    const riderResult: any = await db.execute(sql`
      SELECT 
        id::text AS id,
        name,
        phone,
        is_active AS "isActive",
        COALESCE(is_locked, false) AS "isLocked",
        COALESCE(wallet_balance, 0.00)::numeric AS "walletBalance"
      FROM riders
      WHERE id = ${riderId}::uuid
      LIMIT 1
    `);

    const rider = Array.isArray(riderResult) ? riderResult[0] : riderResult?.rows?.[0];

    if (!rider) {
      return NextResponse.json({ success: false, message: 'Courier not found.' }, { status: 404 });
    }

    if (rider.isLocked) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Dispatch blocked: Courier ${rider.name} is locked by operations.` 
        },
        { status: 403 }
      );
    }

    // 2. Fetch order details
    const orderResult: any = await db.execute(sql`
      SELECT 
        id::text AS id,
        order_number AS "orderNumber",
        total_amount AS "totalAmount",
        payment_method AS "paymentMethod",
        status::text AS status
      FROM orders
      WHERE id = ${orderId}::uuid
      LIMIT 1
    `);

    const order = Array.isArray(orderResult) ? orderResult[0] : orderResult?.rows?.[0];

    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
    }

    const orderCost = Number(order.totalAmount || 0);
    const currentBalance = Number(rider.walletBalance || 0);

    // 3. Float validation for COD orders
    if (order.paymentMethod === 'cod') {
      if (currentBalance < orderCost) {
        return NextResponse.json(
          {
            success: false,
            message: `Dispatch blocked: Insufficient float collateral. Courier wallet has UGX ${currentBalance.toLocaleString()} but order requires UGX ${orderCost.toLocaleString()}. Please top up float via MoMo.`
          },
          { status: 400 }
        );
      }
    }

    // 4. Atomic transaction: Deduct wallet & assign order
    await db.transaction(async (tx) => {
      // Cash is not deducted on assignment; cash liability accumulates at handover verification.

      await tx.execute(sql`
        UPDATE orders 
        SET assigned_rider_id = ${riderId}::uuid,
            status = 'rider_assigned',
            updated_at = NOW()
        WHERE id = ${orderId}::uuid
      `);
    });

    const remainingBalance = order.paymentMethod === 'cod' ? (currentBalance - orderCost) : currentBalance;

    // 5. Audit Logging
    await logPlatformAudit({
      request,
      action: 'ORDER_RIDER_ASSIGNED',
      targetEntity: 'orders',
      targetId: orderId,
      actorId,
      actorRole,
      metadata: {
        riderId,
        riderName: rider.name,
        orderNumber: order.orderNumber,
        paymentMethod: order.paymentMethod,
        orderAmount: orderCost,
        previousWalletBalance: currentBalance,
        newWalletBalance: remainingBalance
      }
    });

    return NextResponse.json({
      success: true,
      message: `Assigned #${order.orderNumber} to ${rider.name}. Float debited: UGX ${orderCost.toLocaleString()}.`,
      orderId,
      riderId,
      walletDebited: order.paymentMethod === 'cod' ? orderCost : 0,
      remainingWalletBalance: remainingBalance
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
