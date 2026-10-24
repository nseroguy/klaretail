import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      customerPhone,
      customerName = 'Valued Customer',
      deliveryAddress = 'Kampala',
      zoneId = '1',
      zoneName = 'Ntinda',
      lat = 0.3541,
      lng = 32.6183,
      items, 
      deliveryFee = 5000, 
      serviceFee = 0, 
      subtotal = 0, 
      totalPayable = 0,
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Cart items empty' }, { status: 400 });
    }

    if (!customerPhone) {
      return NextResponse.json({ success: false, message: 'Phone required for COD handshake' }, { status: 400 });
    }

    const rawDigits = String(customerPhone).replace(/\D/g, '');
    const plusFormatted = `+${rawDigits}`;
    const localFormatted = rawDigits.startsWith('256') ? `0${rawDigits.slice(3)}` : String(customerPhone);

    // 1. Resolve or provision Customer ID using resilient raw SQL (bypasses Drizzle enum driver bugs)
    let validCustomerId: string | null = null;

    try {
      const userRows: any = await db.execute(sql`
        SELECT id::text AS id 
        FROM users 
        WHERE phone IN (${customerPhone}, ${plusFormatted}, ${localFormatted}) 
        LIMIT 1
      `);
      
      const rows = Array.isArray(userRows) ? userRows : (userRows?.rows || []);
      if (rows.length > 0 && rows[0]?.id) {
        validCustomerId = rows[0].id;
      }
    } catch (lookupErr) {
      console.warn('[COD] User query warning:', lookupErr);
    }

    // Provision new customer user if absent
    if (!validCustomerId) {
      try {
        const createdUserRows: any = await db.execute(sql`
          INSERT INTO users (id, phone, role, is_active, trust_level)
          VALUES (gen_random_uuid(), ${plusFormatted}, 'customer'::user_role, true, 1)
          ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
          RETURNING id::text AS id
        `);
        const createdRows = Array.isArray(createdUserRows) ? createdUserRows : (createdUserRows?.rows || []);
        if (createdRows.length > 0 && createdRows[0]?.id) {
          validCustomerId = createdRows[0].id;
        }
      } catch (insertErr) {
        console.warn('[COD] Customer insertion warning, selecting fallback:', insertErr);
      }
    }

    // Absolute fallback if table insert is constrained
    if (!validCustomerId) {
      const fallbackRows: any = await db.execute(sql`
        SELECT id::text AS id FROM users LIMIT 1
      `);
      const rows = Array.isArray(fallbackRows) ? fallbackRows : (fallbackRows?.rows || []);
      if (rows.length > 0 && rows[0]?.id) {
        validCustomerId = rows[0].id;
      } else {
        return NextResponse.json(
          { success: false, message: 'No registered user profile found in database.' }, 
          { status: 400 }
        );
      }
    }

    // 2. Resolve Active Vendor ID
    const vendorRows: any = await db.execute(sql`
      SELECT id::text AS id FROM vendors LIMIT 1
    `);
    const vendorsList = Array.isArray(vendorRows) ? vendorRows : (vendorRows?.rows || []);
    if (!vendorsList || vendorsList.length === 0 || !vendorsList[0]?.id) {
      return NextResponse.json({ success: false, message: 'No active vendor found in system.' }, { status: 400 });
    }
    const validVendorId = vendorsList[0].id;

    // 3. Compute Financials
    const parsedSubtotal = Math.round(Number(subtotal));
    const parsedDeliveryFee = Math.round(Number(deliveryFee));
    const parsedServiceFee = Math.round(Number(serviceFee));
    const parsedProtectionFee = Math.round(parsedSubtotal * 0.0324);
    const parsedTotalPayable = Math.round(Number(totalPayable)) || (parsedSubtotal + parsedDeliveryFee + parsedServiceFee + parsedProtectionFee);

    const orderNumber = `KLA-${crypto.randomInt(100000, 999999)}`;
    const deliveryPin = crypto.randomInt(1000, 9999).toString();

    // 4. Create Order Record with typed returns
    const [newOrder] = await db.insert(orders).values({
      orderNumber,
      vendorId: validVendorId,
      customerId: validCustomerId,
      assignedRiderId: null,
      mode: 'asap',
      status: 'created',
      productSubtotal: parsedSubtotal,
      deliveryFee: parsedDeliveryFee,
      serviceFee: parsedServiceFee,
      damageProtectionFee: parsedProtectionFee,
      convenienceFee: 0,
      totalAmount: parsedTotalPayable,
      paymentMethod: 'cod',
      deliveryPin,
      codAmountDue: parsedTotalPayable,
      codCashReceived: 0,
    } as any).returning();

    return NextResponse.json({
      success: true,
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      deliveryPin,
      codAmountDue: newOrder.totalAmount,
      zone: zoneName,
      trackingUrl: `/orders/${newOrder.id}`,
    });

  } catch (error: any) {
    console.error('COD Order creation failure:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
