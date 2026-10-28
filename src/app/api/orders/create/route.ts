import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawCookie = request.cookies.get('customer_session')?.value;
    if (!rawCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Customer session missing.' }, { status: 401 });
    }

    let session: any = null;
    try {
      let decoded = rawCookie;
      while (decoded.includes('%')) decoded = decodeURIComponent(decoded);
      session = JSON.parse(decoded);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid customer session format.' }, { status: 401 });
    }

    const userId = session?.userId;
    const customerId = session?.customerId;

    if (!userId || !customerId) {
      return NextResponse.json({ success: false, message: 'Malformed session: user or customer ID missing.' }, { status: 400 });
    }

    const { paymentMethod = 'CASH_ON_DELIVERY' } = await request.json().catch(() => ({}));

    // 1. Fetch vendor to fulfill order
    const vendorResult: any = await db.execute(sql`
      SELECT id::text AS id FROM vendors LIMIT 1
    `);
    const vendorId = Array.isArray(vendorResult) ? vendorResult[0]?.id : vendorResult?.rows?.[0]?.id;

    if (!vendorId) {
      return NextResponse.json({ success: false, message: 'No active vendor found.' }, { status: 500 });
    }

    // 2. Fetch customer profile
    const customerResult: any = await db.execute(sql`
      SELECT id::text AS id, phone, full_name AS "fullName"
      FROM customers
      WHERE id = ${customerId}::uuid
      LIMIT 1
    `);
    const customer = Array.isArray(customerResult) ? customerResult[0] : customerResult?.rows?.[0];

    if (!customer) {
      return NextResponse.json({ success: false, message: 'Customer account not found.' }, { status: 404 });
    }

    // 3. Generate identifiers & pricing (Integer UGX amounts)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const orderNumber = `KLA-${dateStr}-${randomSuffix}`;
    const deliveryPin = Math.floor(1000 + Math.random() * 9000).toString();

    const productSubtotal = 45000;
    const deliveryFee = 5000;
    const serviceFee = 0;
    const damageProtectionFee = 0;
    const convenienceFee = 0;
    const totalAmount = productSubtotal + deliveryFee;

    // 4. Insert into orders table (customer_id points to users.id per FK)
    const orderResult: any = await db.execute(sql`
      INSERT INTO orders (
        order_number,
        customer_id,
        vendor_id,
        mode,
        status,
        product_subtotal,
        delivery_fee,
        service_fee,
        damage_protection_fee,
        convenience_fee,
        total_amount,
        payment_method,
        delivery_pin,
        cod_amount_due,
        created_at,
        updated_at
      ) VALUES (
        ${orderNumber},
        ${userId}::uuid,
        ${vendorId}::uuid,
        'asap'::order_mode,
        'created'::order_status,
        ${productSubtotal},
        ${deliveryFee},
        ${serviceFee},
        ${damageProtectionFee},
        ${convenienceFee},
        ${totalAmount},
        ${paymentMethod},
        ${deliveryPin},
        ${totalAmount},
        NOW(),
        NOW()
      )
      RETURNING 
        id::text AS id,
        order_number AS "orderNumber",
        customer_id::text AS "customerId",
        delivery_pin AS "deliveryPin",
        total_amount AS "totalAmount",
        status::text AS status,
        created_at AS "createdAt"
    `);

    const order = Array.isArray(orderResult) ? orderResult[0] : orderResult?.rows?.[0];

    // 5. Increment customer metrics
    await db.execute(sql`
      UPDATE customers
      SET total_orders = total_orders + 1,
          lifetime_spend = lifetime_spend + ${totalAmount},
          updated_at = NOW()
      WHERE id = ${customerId}::uuid
    `);

    try {
      await logPlatformAudit({
        request,
        action: 'ORDER_PLACED',
        targetEntity: 'orders',
        targetId: order.id,
        actorId: customerId,
        actorRole: 'customer',
        metadata: { orderNumber, totalAmount, paymentMethod, deliveryPin }
      });
    } catch (auditErr: any) {
      console.warn('Audit warning:', auditErr.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Order created successfully.',
      orderNumber: order.orderNumber,
      orderId: order.id,
      deliveryPin: order.deliveryPin,
      totalAmount: order.totalAmount,
      status: order.status
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to place order.' }, { status: 500 });
  }
}
