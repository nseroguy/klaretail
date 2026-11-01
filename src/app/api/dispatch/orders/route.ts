import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const listRes: any = await db.execute(sql`
      -- 1. B2C Consumer Orders
      SELECT 
        o.id::text AS id,
        o.order_number AS "orderNumber",
        'B2C_RETAIL' AS "orderType",
        o.total_amount::numeric AS "totalAmount",
        o.status::text AS status,
        o.payment_method::text AS "paymentMethod",
        o.delivery_pin AS "deliveryPin",
        o.rider_id::text AS "riderId",
        NULL AS "supplierName",
        NULL AS "retailerName",
        o.delivery_address AS "deliveryAddress",
        o.created_at AS "createdAt"
      FROM orders o

      UNION ALL

      -- 2. B2B Wholesale Restock Orders
      SELECT 
        po.id::text AS id,
        po.order_number AS "orderNumber",
        'B2B_RESTOCK' AS "orderType",
        po.total_amount::numeric AS "totalAmount",
        po.status::text AS status,
        po.payment_terms::text AS "paymentMethod",
        po.handover_pin AS "deliveryPin",
        NULL AS "riderId",
        ws.name AS "supplierName",
        rb.name AS "retailerName",
        po.delivery_address AS "deliveryAddress",
        po.created_at AS "createdAt"
      FROM b2b_purchase_orders po
      JOIN vendors ws ON po.wholesaler_vendor_id = ws.id
      JOIN vendors rb ON po.retail_vendor_id = rb.id

      ORDER BY "createdAt" DESC
      LIMIT 50;
    `);

    const list = Array.isArray(listRes) ? listRes : listRes?.rows || [];

    return NextResponse.json({ success: true, orders: list });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
