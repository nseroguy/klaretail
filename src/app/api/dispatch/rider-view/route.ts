import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function extractSessionPayload(rawCookie: string | undefined): any {
  if (!rawCookie) return null;
  try {
    let decoded = rawCookie;
    while (decoded.includes('%')) {
      decoded = decodeURIComponent(decoded);
    }
    return JSON.parse(decoded);
  } catch {
    try {
      let b64 = rawCookie;
      while (b64.includes('%')) {
        b64 = decodeURIComponent(b64);
      }
      return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
    } catch {
      return null;
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cookieStore = await cookies();

    const rawCookie = 
      cookieStore.get('staff_session')?.value ||
      cookieStore.get('session_token')?.value ||
      cookieStore.get('klaretail_session')?.value ||
      cookieStore.get('super_admin_session')?.value;

    const session = extractSessionPayload(rawCookie);

    const queryPhone = searchParams.get('phone');
    const queryRiderId = searchParams.get('riderId');
    const headerPhone = request.headers.get('x-rider-phone');
    const headerId = request.headers.get('x-rider-id');

    const effectivePhone = (queryPhone || headerPhone || session?.phone || '').trim();
    const effectiveId = (queryRiderId || headerId || session?.id || '').trim();

    if (!effectivePhone && !effectiveId) {
      return NextResponse.json({ success: false, message: 'Rider phone or active session required.' }, { status: 401 });
    }

    const digitsOnly = effectivePhone.replace(/\D/g, '');
    const phoneSuffix = digitsOnly.length >= 9 ? digitsOnly.slice(-9) : (digitsOnly || 'NOMATCH');
    const fullIntl = digitsOnly.length > 0 ? `+${digitsOnly}` : 'NOMATCH';

    // 1. Fetch rider profile
    const riderResult: any = await db.execute(sql`
      SELECT 
        r.id::text AS id, 
        r.name, 
        r.phone, 
        r.vehicle_plate AS "vehiclePlate",
        r.capacity_tier AS "capacityTier",
        r.max_payload_kg AS "maxPayloadKg",
        r.max_volume_cbm AS "maxVolumeCbm",
        r.is_active AS "isActive",
        r.is_available AS "isAvailable",
        r.wallet_balance AS "walletBalance",
        r.max_cash_limit AS "maxCashLimit"
      FROM riders r
      WHERE r.id::text = ${effectiveId}
         OR r.phone = ${effectivePhone}
         OR r.phone = ${fullIntl}
         OR r.phone LIKE ${'%' + phoneSuffix}
      LIMIT 1;
    `);

    const rider = riderResult.rows?.[0] || riderResult[0];

    if (!rider) {
      return NextResponse.json({ 
        success: false, 
        message: `Rider account not found for phone: ${effectivePhone || effectiveId}`,
        rider: null,
        assignedOrders: []
      }, { status: 404 });
    }

    // 2. Fetch assigned orders (Consumer B2C Deliveries + Wholesale B2B Restocks)
    const ordersResult: any = await db.execute(sql`
      -- 1. Consumer B2C Deliveries
      SELECT 
        o.id::text AS id,
        o.order_number AS "orderNumber",
        'B2C' AS "orderType",
        COALESCE(c.full_name, 'Valued Customer') AS "customerName",
        COALESCE(c.phone, ${rider.phone}) AS "customerPhone",
        COALESCE(c.default_address, 'Kampala Drop-off') AS "deliveryAddress",
        o.delivery_pin AS "deliveryPin",
        o.pickup_code AS "pickupCode",
        NULL::text AS "supplierPickupPin",
        o.total_amount::numeric AS "totalAmount",
        COALESCE(o.cod_amount_due, o.total_amount)::numeric AS "codAmountDue",
        o.payment_method AS "paymentMethod",
        o.status::text AS status,
        COALESCE(v.name, 'Restaurant Kitchen') AS "vendorName",
        COALESCE(v.name, 'Kampala Hub') AS "vendorAddress",
        'BODA' AS "requiredVehicleTier",
        0::integer AS "cratesCount",
        o.created_at AS "createdAt"
      FROM orders o
      LEFT JOIN customers c ON c.user_id = o.customer_id
      LEFT JOIN vendors v ON v.id = o.vendor_id
      WHERE (o.assigned_rider_id = ${rider.id}::uuid OR o.rider_id = ${rider.id}::uuid)
        AND LOWER(o.status::text) NOT IN ('completed', 'cancelled')

      UNION ALL

      -- 2. Wholesale B2B Restocks
      SELECT 
        po.id::text AS id,
        po.order_number AS "orderNumber",
        'B2B' AS "orderType",
        COALESCE(rb.name, 'Retailer Store') AS "customerName",
        '+256700000000'::text AS "customerPhone",
        COALESCE(po.delivery_address, 'Retail Delivery Point') AS "deliveryAddress",
        po.handover_pin AS "deliveryPin",
        NULL::text AS "pickupCode",
        po.supplier_pickup_pin AS "supplierPickupPin",
        po.total_amount::numeric AS "totalAmount",
        0.00::numeric AS "codAmountDue",
        COALESCE(po.payment_terms::text, 'SNPL_14D') AS "paymentMethod",
        po.status::text AS status,
        COALESCE(ws.name, 'Wholesale Depot') AS "vendorName",
        COALESCE(ws.name, 'Supplier Warehouse') AS "vendorAddress",
        COALESCE(po.required_vehicle_tier, 'CARGO_TUK_TUK') AS "requiredVehicleTier",
        COALESCE(po.crates_expected, po.crates_delivered, 0)::integer AS "cratesCount",
        po.created_at AS "createdAt"
      FROM b2b_purchase_orders po
      LEFT JOIN vendors ws ON po.wholesaler_vendor_id = ws.id
      LEFT JOIN vendors rb ON po.retail_vendor_id = rb.id
      WHERE po.assigned_rider_id = ${rider.id}::uuid
        AND po.status::text IN ('ACCEPTED', 'IN_TRANSIT', 'DELIVERED_AND_RECEIVED')

      ORDER BY "createdAt" DESC;
    `);

    const orders = Array.isArray(ordersResult) ? ordersResult : (ordersResult?.rows || []);

    return NextResponse.json({
      success: true,
      rider,
      assignedOrders: orders || []
    });
  } catch (error: any) {
    console.error('[RIDER-VIEW ERROR]:', error);
    return NextResponse.json({ 
      success: false, 
      message: error?.message || 'Failed to retrieve rider dispatch view.'
    }, { status: 500 });
  }
}
