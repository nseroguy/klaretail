import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, message: 'Order ID is required.' }, { status: 400 });
    }

    const orderResult: any = await db.execute(sql`
      SELECT 
        o.id::text AS id,
        o.order_number AS "orderNumber",
        o.status::text AS status,
        o.mode::text AS mode,
        o.payment_method AS "paymentMethod",
        o.product_subtotal::numeric AS "productSubtotal",
        o.delivery_fee::numeric AS "deliveryFee",
        o.total_amount::numeric AS "totalAmount",
        o.delivery_pin AS "deliveryPin",
        o.pickup_code AS "pickupCode",
        o.created_at AS "createdAt",
        o.updated_at AS "updatedAt",
        c.full_name AS "customerName",
        c.phone AS "customerPhone",
        c.default_address AS "deliveryAddress",
        r.name AS "riderName",
        r.phone AS "riderPhone",
        r.vehicle_plate AS "riderPlate",
        v.name AS "vendorName"
      FROM orders o
      LEFT JOIN customers c ON c.user_id = o.customer_id
      LEFT JOIN riders r ON r.id = o.assigned_rider_id
      LEFT JOIN vendors v ON v.id = o.vendor_id
      WHERE o.id = ${id}::uuid
      LIMIT 1
    `);

    const order = Array.isArray(orderResult) ? orderResult[0] : orderResult?.rows?.[0];

    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
    }

    // Direct extraction matching order_items schema
    const itemsResult: any = await db.execute(sql`
      SELECT 
        id::text AS id,
        name,
        quantity,
        unit_price::numeric AS "unitPrice",
        total_price::numeric AS "totalPrice"
      FROM order_items
      WHERE order_id = ${id}::uuid
    `);

    const items = Array.isArray(itemsResult) ? itemsResult : itemsResult?.rows || [];
    order.items = items.length > 0 ? items : [
      {
        id: `default-${order.id}`,
        name: "Platter Order",
        quantity: 1,
        unitPrice: Number(order.productSubtotal) || 45000,
        totalPrice: Number(order.productSubtotal) || 45000
      }
    ];

    return NextResponse.json({
      success: true,
      order
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to retrieve order status.' }, { status: 500 });
  }
}
