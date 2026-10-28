import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ordersResult: any = await db.execute(sql`
      SELECT 
        o.id::text AS id,
        o.order_number AS "orderNumber",
        o.status::text AS status,
        o.mode::text AS mode,
        o.payment_method::text AS "paymentMethod",
        o.product_subtotal AS "productSubtotal",
        o.delivery_fee AS "deliveryFee",
        o.total_amount AS "totalAmount",
        o.delivery_pin AS "deliveryPin",
        o.cod_amount_due::text AS "codAmountDue",
        o.cod_cash_received::text AS "codCashReceived",
        o.cod_verified_at AS "codVerifiedAt",
        o.assigned_rider_id::text AS "assignedRiderId",
        r.name AS "riderName",
        r.phone AS "riderPhone",
        r.vehicle_plate AS "riderVehiclePlate",
        o.customer_id::text AS "customerId",
        o.created_at AS "createdAt"
      FROM orders o
      LEFT JOIN riders r ON o.assigned_rider_id = r.id
      ORDER BY o.created_at DESC
      LIMIT 50
    `);

    const ridersResult: any = await db.execute(sql`
      SELECT 
        id::text AS id,
        name,
        phone,
        vehicle_plate AS "vehiclePlate",
        is_active AS "isActive"
      FROM riders
      WHERE is_active = true
      ORDER BY name ASC
    `);

    const orders = Array.isArray(ordersResult) ? ordersResult : (ordersResult?.rows || []);
    const riders = Array.isArray(ridersResult) ? ridersResult : (ridersResult?.rows || []);

    return NextResponse.json({
      success: true,
      orders,
      riders,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, action, riderId, pin } = body;

    if (!orderId) {
      return NextResponse.json({ success: false, message: 'orderId is required' }, { status: 400 });
    }

    if (action === 'assign_rider') {
      if (!riderId) {
        return NextResponse.json({ success: false, message: 'riderId is required' }, { status: 400 });
      }

      await db.execute(sql`
        UPDATE orders 
        SET assigned_rider_id = ${riderId}::uuid, 
            status = 'rider_assigned'::order_status 
        WHERE id = ${orderId}::uuid
      `);

      await logPlatformAudit({
        request,
        action: 'ORDER_RIDER_ASSIGNED',
        targetEntity: 'orders',
        targetId: orderId,
        metadata: { assignedRiderId: riderId }
      });

      return NextResponse.json({ success: true, message: 'Rider assigned successfully.' });
    }

    if (action === 'verify_pin') {
      const checkResult: any = await db.execute(sql`
        SELECT delivery_pin, total_amount, payment_method::text AS payment_method 
        FROM orders 
        WHERE id = ${orderId}::uuid
      `);
      const order = Array.isArray(checkResult) ? checkResult[0] : checkResult?.rows?.[0];

      if (!order) {
        return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
      }

      if (order.delivery_pin && order.delivery_pin !== pin) {
        await logPlatformAudit({
          request,
          action: 'COD_PIN_VERIFY_FAILED',
          targetEntity: 'orders',
          targetId: orderId,
          metadata: { attemptedPin: pin }
        });
        return NextResponse.json({ success: false, message: 'Invalid delivery handshake PIN' }, { status: 400 });
      }

      await db.execute(sql`
        UPDATE orders 
        SET status = 'delivered'::order_status,
            cod_cash_received = total_amount::numeric,
            cod_verified_at = NOW()
        WHERE id = ${orderId}::uuid
      `);

      await logPlatformAudit({
        request,
        action: 'COD_HANDSHAKE_SETTLED',
        targetEntity: 'orders',
        targetId: orderId,
        metadata: {
          settledAmount: order.total_amount,
          reconciledViaPin: pin
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Handshake PIN verified. Cash reconciled to delivered.'
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
