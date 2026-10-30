import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawCookie = request.cookies.get('staff_session')?.value;
    if (!rawCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Courier session missing.' }, { status: 401 });
    }

    let session: any = null;
    try {
      let decoded = rawCookie;
      while (decoded.includes('%')) decoded = decodeURIComponent(decoded);
      session = JSON.parse(decoded);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid session format.' }, { status: 401 });
    }

    const phone = session?.phone;
    if (!phone) {
      return NextResponse.json({ success: false, message: 'Malformed session: phone required.' }, { status: 401 });
    }

    const { orderId, deliveryPin, cashCollected } = await request.json();

    if (!orderId || !deliveryPin) {
      return NextResponse.json({
        success: false,
        message: 'Order ID and 4-digit Customer Delivery PIN are required.'
      }, { status: 400 });
    }

    // 1. Fetch courier profile
    const riderResult: any = await db.execute(sql`
      SELECT id::text AS id, name, phone, wallet_balance::numeric AS "walletBalance", is_locked AS "isLocked"
      FROM riders
      WHERE phone = ${phone.trim()}::text
      LIMIT 1
    `);
    const rider = Array.isArray(riderResult) ? riderResult[0] : riderResult?.rows?.[0];

    if (!rider) {
      return NextResponse.json({ success: false, message: 'Courier profile not found.' }, { status: 404 });
    }

    // 2. Fetch order to verify
    const orderResult: any = await db.execute(sql`
      SELECT 
        id::text AS id,
        order_number AS "orderNumber",
        delivery_pin AS "deliveryPin",
        payment_method AS "paymentMethod",
        cod_amount_due::numeric AS "codAmountDue",
        total_amount AS "totalAmount",
        status::text AS status,
        assigned_rider_id::text AS "assignedRiderId"
      FROM orders
      WHERE id = ${orderId}::uuid
      LIMIT 1
    `);
    const order = Array.isArray(orderResult) ? orderResult[0] : orderResult?.rows?.[0];

    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
    }

    if (order.assignedRiderId !== rider.id) {
      return NextResponse.json({ success: false, message: 'Order is assigned to a different courier.' }, { status: 403 });
    }

    if (order.status === 'delivered') {
      return NextResponse.json({ success: false, message: 'Order has already been marked delivered.' }, { status: 400 });
    }

    // 3. Verify Delivery PIN
    if (String(order.deliveryPin).trim() !== String(deliveryPin).trim()) {
      return NextResponse.json({
        success: false,
        message: 'Invalid Delivery PIN provided by customer. Handover rejected.'
      }, { status: 422 });
    }

    const isCod = order.paymentMethod === 'cod' || order.paymentMethod === 'CASH_ON_DELIVERY';
    const codReceived = isCod 
      ? Number(cashCollected || order.codAmountDue || order.totalAmount)
      : 0.00;

    // 4. Atomic Handover Execution & Ledger Settlement
    await db.execute(sql`
      UPDATE orders
      SET status = 'delivered'::order_status,
          cod_cash_received = ${codReceived},
          cod_verified_at = NOW(),
          updated_at = NOW()
      WHERE id = ${order.id}::uuid
    `);

    // 5. Update courier wallet balance and trip lock if limit exceeded
    await db.execute(sql`
      UPDATE riders
      SET wallet_balance = wallet_balance + ${codReceived},
          is_available = CASE 
            WHEN (wallet_balance + ${codReceived}) >= COALESCE(max_cash_limit, 50000.00) THEN false 
            ELSE true 
          END,
          is_locked = CASE 
            WHEN (wallet_balance + ${codReceived}) >= COALESCE(max_cash_limit, 50000.00) THEN true 
            ELSE is_locked 
          END,
          updated_at = NOW()
      WHERE id = ${rider.id}::uuid
    `);

    await logPlatformAudit({
      request,
      action: 'ORDER_HANDOVER_VERIFIED',
      targetEntity: 'orders',
      targetId: order.id,
      actorId: session.id,
      actorRole: 'rider',
      metadata: {
        orderNumber: order.orderNumber,
        codReceived,
        courier: rider.name,
        verifiedViaPin: true
      }
    });

    return NextResponse.json({
      success: true,
      message: `Handover verified successfully. Order #${order.orderNumber} delivered.`,
      orderNumber: order.orderNumber,
      status: 'delivered',
      cashCollected: codReceived,
      courier: rider.name
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Handover verification failed.' }, { status: 500 });
  }
}
