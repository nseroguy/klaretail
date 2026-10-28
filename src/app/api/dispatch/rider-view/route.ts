import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rawCookie = request.cookies.get('staff_session')?.value;

    if (!rawCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Session missing.' }, { status: 401 });
    }

    let decoded = rawCookie;
    while (decoded.includes('%')) {
      decoded = decodeURIComponent(decoded);
    }
    const session = JSON.parse(decoded);

    const phone = session?.phone;
    if (!phone) {
      return NextResponse.json({ success: false, message: 'Malformed session: phone required.' }, { status: 401 });
    }

    // 1. Fetch courier profile
    const riderResult: any = await db.execute(sql`
      SELECT 
        id::text AS id,
        name,
        phone,
        vehicle_plate AS "vehiclePlate",
        is_active AS "isActive",
        is_available AS "isAvailable",
        is_locked AS "isLocked",
        current_latitude AS "currentLatitude",
        current_longitude AS "currentLongitude",
        COALESCE(max_cash_limit, 50000.00)::numeric AS "maxCashLimit",
        COALESCE(wallet_balance, 0.00)::numeric AS "walletBalance"
      FROM riders
      WHERE phone = ${phone.trim()}::text
      LIMIT 1
    `);

    const rider = Array.isArray(riderResult) ? riderResult[0] : riderResult?.rows?.[0];

    if (!rider) {
      return NextResponse.json({ success: false, message: 'Courier profile not found for this account.' }, { status: 404 });
    }

    // 2. Fetch assigned orders with complete vendor & customer metadata
    const ordersResult: any = await db.execute(sql`
      SELECT 
        o.id::text AS id,
        o.order_number AS "orderNumber",
        COALESCE(c.full_name, 'Valued Customer') AS "customerName",
        COALESCE(c.phone, ${phone}) AS "customerPhone",
        COALESCE(c.default_address, 'Kampala Drop-off') AS "deliveryAddress",
        o.delivery_pin AS "deliveryPin",
        o.pickup_code AS "pickupCode",
        o.total_amount AS "totalAmount",
        COALESCE(o.cod_amount_due, o.total_amount)::numeric AS "codAmountDue",
        o.payment_method AS "paymentMethod",
        o.status::text AS status,
        o.created_at AS "createdAt",
        COALESCE(v.name, 'Restaurant Kitchen') AS "vendorName"
      FROM orders o
      LEFT JOIN customers c ON c.user_id = o.customer_id
      LEFT JOIN vendors v ON v.id = o.vendor_id
      WHERE (o.assigned_rider_id = ${rider.id}::uuid OR o.rider_id = ${rider.id}::uuid)
      ORDER BY o.created_at DESC
    `);

    const orders = Array.isArray(ordersResult) ? ordersResult : (ordersResult?.rows || []);

    return NextResponse.json({
      success: true,
      rider,
      assignedOrders: orders || []
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to retrieve rider dispatch view.' }, { status: 500 });
  }
}
