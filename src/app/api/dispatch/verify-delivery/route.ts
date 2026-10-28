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
    let actorRole = 'rider';

    if (rawCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(rawCookie));
        actorId = parsed?.id || actorId;
        actorRole = parsed?.role || actorRole;
      } catch {}
    }

    const { orderId, pin } = await request.json();

    if (!orderId || !pin) {
      return NextResponse.json(
        { success: false, message: 'Both orderId and PIN are required.' },
        { status: 400 }
      );
    }

    // 1. Fetch order details and delivery PIN
    const orderResult: any = await db.execute(sql`
      SELECT 
        id::text AS id,
        order_number AS "orderNumber",
        total_amount AS "totalAmount",
        delivery_pin AS "deliveryPin",
        payment_method AS "paymentMethod",
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

    if (order.status === 'delivered') {
      return NextResponse.json({ success: false, message: 'Order is already delivered.' }, { status: 400 });
    }

    // 2. Validate 4-digit customer PIN
    if (String(order.deliveryPin).trim() !== String(pin).trim()) {
      return NextResponse.json(
        { success: false, message: 'Invalid delivery handshake PIN.' },
        { status: 401 }
      );
    }

    // 3. Mark delivered and record received cash
    await db.execute(sql`
      UPDATE orders 
      SET status = 'delivered',
          cod_cash_received = total_amount,
          updated_at = NOW()
      WHERE id = ${orderId}::uuid
    `);

    // 4. Log audit ledger event
    await logPlatformAudit({
      request,
      action: 'DELIVERY_PIN_VERIFIED',
      targetEntity: 'orders',
      targetId: orderId,
      actorId,
      actorRole,
      metadata: {
        orderNumber: order.orderNumber,
        assignedRiderId: order.assignedRiderId,
        paymentMethod: order.paymentMethod,
        amountSettled: Number(order.totalAmount),
        handshake: 'PIN_CONFIRMED'
      }
    });

    return NextResponse.json({
      success: true,
      message: `Order #${order.orderNumber} successfully delivered and settled.`,
      orderId,
      status: 'delivered'
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Verification failed.' }, { status: 500 });
  }
}
