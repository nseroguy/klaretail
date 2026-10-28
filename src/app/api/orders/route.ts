import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rawCookie = request.cookies.get('customer_session')?.value;
    if (!rawCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Session missing.' }, { status: 401 });
    }

    let session: any = null;
    try {
      let decoded = rawCookie;
      while (decoded.includes('%')) decoded = decodeURIComponent(decoded);
      session = JSON.parse(decoded);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid session.' }, { status: 401 });
    }

    const customerId = session?.customerId;
    const userId = session?.userId;

    if (!customerId && !userId) {
      return NextResponse.json({ success: false, message: 'Invalid session identifiers.' }, { status: 400 });
    }

    const ordersResult: any = await db.execute(sql`
      SELECT 
        o.id::text AS id,
        o.order_number AS "orderNumber",
        o.status::text AS status,
        o.total_amount::numeric AS "totalAmount",
        COALESCE(o.cod_amount_due, o.total_amount)::numeric AS "codAmountDue",
        o.payment_method AS "paymentMethod",
        o.delivery_pin AS "deliveryPin",
        o.created_at AS "createdAt",
        COALESCE(v.name, 'Merchant Kitchen') AS "vendorName",
        COALESCE(r.name, 'Pending Courier') AS "courierName",
        COALESCE(r.phone, '') AS "courierPhone"
      FROM orders o
      LEFT JOIN vendors v ON v.id = o.vendor_id
      LEFT JOIN riders r ON r.id = o.assigned_rider_id
      WHERE (o.customer_id = ${userId}::uuid OR o.customer_id = ${customerId}::uuid)
      ORDER BY o.created_at DESC
    `);

    const orders = Array.isArray(ordersResult) ? ordersResult : (ordersResult?.rows || []);

    return NextResponse.json({
      success: true,
      orders: orders || []
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to fetch orders.' }, { status: 500 });
  }
}
