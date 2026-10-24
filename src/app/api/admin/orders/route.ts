import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
        COALESCE(o.delivery_pin, '') AS "deliveryPin",
        o.cod_amount_due AS "codAmountDue",
        o.cod_cash_received AS "codCashReceived",
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
      LIMIT 50;
    `);

    const ridersResult: any = await db.execute(sql`
      SELECT 
        id::text AS id,
        name,
        phone,
        vehicle_plate AS "vehiclePlate"
      FROM riders
      WHERE is_active = true
      ORDER BY name ASC;
    `);

    const orders = Array.isArray(ordersResult) ? ordersResult : (ordersResult?.rows || []);
    const riders = Array.isArray(ridersResult) ? ridersResult : (ridersResult?.rows || []);

    return NextResponse.json({ success: true, orders, riders });
  } catch (error: any) {
    console.error('Fetch admin orders failure:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, action, riderId, pin } = body;

    if (!orderId || !UUID_REGEX.test(orderId)) {
      return NextResponse.json({ success: false, message: 'Valid UUID orderId is required' }, { status: 400 });
    }

    const orderIdLiteral = sql.raw(`'${orderId}'`);

    if (action === 'assign_rider') {
      if (!riderId || !UUID_REGEX.test(riderId)) {
        return NextResponse.json({ success: false, message: 'Valid UUID riderId is required for assignment' }, { status: 400 });
      }

      const riderIdLiteral = sql.raw(`'${riderId}'`);

      await db.execute(sql`
        UPDATE orders
        SET 
          assigned_rider_id = ${riderIdLiteral},
          status = 'rider_assigned'::order_status
        WHERE id = ${orderIdLiteral};
      `);

      return NextResponse.json({ success: true, message: 'Courier assigned successfully.' });
    }

    if (action === 'verify_pin') {
      if (!pin) {
        return NextResponse.json({ success: false, message: 'Delivery PIN is required.' }, { status: 400 });
      }

      const orderQueryResult: any = await db.execute(sql`
        SELECT 
          id::text AS id, 
          total_amount AS "totalAmount", 
          delivery_pin AS "deliveryPin"
        FROM orders
        WHERE id = ${orderIdLiteral}
        LIMIT 1;
      `);

      const rows = Array.isArray(orderQueryResult) ? orderQueryResult : (orderQueryResult?.rows || []);
      const order = rows[0];

      if (!order) {
        return NextResponse.json({ success: false, message: 'Order not found in registry.' }, { status: 404 });
      }

      const cleanExpectedPin = String(order.deliveryPin).trim();
      const cleanInputPin = String(pin).trim();

      if (cleanExpectedPin !== cleanInputPin) {
        return NextResponse.json({ 
          success: false, 
          message: `Incorrect Handshake PIN. Expected ${cleanExpectedPin}, received ${cleanInputPin}.` 
        }, { status: 400 });
      }

      const numericTotal = Number(order.totalAmount);

      await db.execute(sql`
        UPDATE orders
        SET 
          status = 'delivered'::order_status,
          cod_cash_received = ${numericTotal},
          cod_verified_at = NOW()
        WHERE id = ${orderIdLiteral};
      `);

      return NextResponse.json({
        success: true,
        message: 'Handshake PIN verified. Cash reconciled to delivered.',
      });
    }

    return NextResponse.json({ success: false, message: 'Unknown action specified.' }, { status: 400 });
  } catch (error: any) {
    console.error('Update order failure:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
