import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ordersResult: any = await db.execute(sql`
      -- 1. B2C Orders
      SELECT 
        o.id::text AS id,
        o.order_number AS "orderNumber",
        'B2C' AS "orderType",
        o.status::text AS status,
        o.mode::text AS mode,
        o.payment_method::text AS "paymentMethod",
        o.product_subtotal::numeric AS "productSubtotal",
        o.delivery_fee::numeric AS "deliveryFee",
        o.total_amount::numeric AS "totalAmount",
        o.delivery_pin AS "deliveryPin",
        o.cod_amount_due::text AS "codAmountDue",
        o.cod_cash_received::text AS "codCashReceived",
        o.cod_verified_at AS "codVerifiedAt",
        o.assigned_rider_id::text AS "assignedRiderId",
        r.name AS "riderName",
        r.phone AS "riderPhone",
        r.vehicle_plate AS "riderVehiclePlate",
        o.customer_id::text AS "customerId",
        NULL AS "wholesalerName",
        NULL AS "retailerName",
        o.delivery_address AS "deliveryAddress",
        o.created_at AS "createdAt"
      FROM orders o
      LEFT JOIN riders r ON o.assigned_rider_id = r.id

      UNION ALL

      -- 2. B2B Wholesale Orders
      SELECT 
        po.id::text AS id,
        po.order_number AS "orderNumber",
        'B2B' AS "orderType",
        po.status::text AS status,
        'DELIVERY' AS mode,
        po.payment_terms::text AS "paymentMethod",
        po.subtotal::numeric AS "productSubtotal",
        po.delivery_fee::numeric AS "deliveryFee",
        po.total_amount::numeric AS "totalAmount",
        po.handover_pin AS "deliveryPin",
        '0.00' AS "codAmountDue",
        '0.00' AS "codCashReceived",
        NULL AS "codVerifiedAt",
        po.assigned_rider_id::text AS "assignedRiderId",
        r.name AS "riderName",
        r.phone AS "riderPhone",
        r.vehicle_plate AS "riderVehiclePlate",
        po.retail_vendor_id::text AS "customerId",
        ws.name AS "wholesalerName",
        rb.name AS "retailerName",
        po.delivery_address AS "deliveryAddress",
        po.created_at AS "createdAt"
      FROM b2b_purchase_orders po
      JOIN vendors ws ON po.wholesaler_vendor_id = ws.id
      JOIN vendors rb ON po.retail_vendor_id = rb.id
      LEFT JOIN riders r ON po.assigned_rider_id = r.id

      ORDER BY "createdAt" DESC
      LIMIT 100;
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
      ORDER BY name ASC;
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

    // Check if orderId belongs to B2B purchase orders
    const b2bCheck: any = await db.execute(sql`
      SELECT id, order_number, status, handover_pin, total_amount, wholesaler_vendor_id, retail_vendor_id
      FROM b2b_purchase_orders
      WHERE id = ${orderId}::uuid OR order_number = ${orderId}
      LIMIT 1;
    `);
    const b2bOrder = Array.isArray(b2bCheck) ? b2bCheck[0] : b2bCheck?.rows?.[0];

    // --- B2B ORDER HANDLING ---
    if (b2bOrder) {
      if (action === 'assign_rider') {
        if (!riderId) {
          return NextResponse.json({ success: false, message: 'riderId is required' }, { status: 400 });
        }

        await db.execute(sql`
          UPDATE b2b_purchase_orders
          SET assigned_rider_id = ${riderId}::uuid,
              status = 'IN_TRANSIT'::b2b_order_status,
              updated_at = NOW()
          WHERE id = ${b2bOrder.id}::uuid;
        `);

        await logPlatformAudit({
          request,
          action: 'B2B_ORDER_RIDER_ASSIGNED',
          targetEntity: 'b2b_purchase_orders',
          targetId: b2bOrder.id,
          metadata: { assignedRiderId: riderId, orderNumber: b2bOrder.order_number }
        });

        return NextResponse.json({ success: true, message: `Rider assigned to B2B Order ${b2bOrder.order_number}. Status updated to IN_TRANSIT.` });
      }

      if (action === 'verify_pin') {
        if (b2bOrder.handover_pin && b2bOrder.handover_pin !== String(pin).trim()) {
          return NextResponse.json({ success: false, message: 'Invalid delivery handshake PIN for this purchase order.' }, { status: 400 });
        }

        // Delegate to atomic settlement
        const verifyRes = await fetch(new URL('/api/vendor/b2b/orders/verify-reception', request.url).toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            orderNumber: b2bOrder.order_number,
            handoverPin: pin,
          }),
        });

        const verifyData = await verifyRes.json();
        if (!verifyRes.ok || !verifyData.success) {
          return NextResponse.json({ success: false, message: verifyData.message || 'Settlement failed.' }, { status: verifyRes.status });
        }

        return NextResponse.json({
          success: true,
          message: `B2B Order ${b2bOrder.order_number} verified and settled. Stock inwarded.`
        });
      }

      return NextResponse.json({ success: false, message: 'Invalid B2B action' }, { status: 400 });
    }

    // --- B2C ORDER HANDLING ---
    if (action === 'assign_rider') {
      if (!riderId) {
        return NextResponse.json({ success: false, message: 'riderId is required' }, { status: 400 });
      }

      await db.execute(sql`
        UPDATE orders 
        SET assigned_rider_id = ${riderId}::uuid, 
            status = 'rider_assigned'::order_status 
        WHERE id = ${orderId}::uuid;
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
        WHERE id = ${orderId}::uuid;
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
        WHERE id = ${orderId}::uuid;
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
