import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import dns from 'node:dns';

// Force runtime DNS resolution to IPv4 first, preventing ETIMEDOUT fetch failures
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // Ignore in environments where not supported
}

function getDbClient() {
  const directUrl = (process.env.DATABASE_URL || '').replace('-pooler', '');
  return neon(directUrl);
}

async function getPesapalToken() {
  const baseUrl = process.env.PESAPAL_BASE_URL || 'https://pay.pesapal.com/v3/api';
  console.log('[Order API] Requesting Pesapal token from:', baseUrl);

  const res = await fetch(`${baseUrl}/Auth/RequestToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      consumer_key: process.env.PESAPAL_CONSUMER_KEY,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET,
    }),
    signal: AbortSignal.timeout(10000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Pesapal Auth failed [HTTP ${res.status}]: ${text}`);
  }

  const data = JSON.parse(text);
  if (!data.token) {
    throw new Error(`Pesapal token missing in response: ${text}`);
  }
  return data.token;
}

export async function POST(req: NextRequest) {
  console.log('[Order API] Processing order creation request');
  try {
    const body = await req.json();
    const { slotStart, pricing, paymentMethod, customerDetails } = body;
    const sql = getDbClient();

    // 1. Resolve Active Vendor
    const vendors = await sql`SELECT id FROM vendors LIMIT 1;`;
    if (vendors.length === 0) {
      throw new Error('No vendor found in database');
    }
    const vendorId = vendors[0].id;

    // 2. Resolve Customer User
    const phone = customerDetails?.phone || '+256772123456';
    let customerRows = await sql`SELECT id FROM users WHERE phone = ${phone} LIMIT 1;`;
    let customerId: string;

    if (customerRows.length > 0) {
      customerId = customerRows[0].id;
    } else {
      console.log('[Order API] Inserting customer record for:', phone);
      const newCustomer = await sql`
        INSERT INTO users (
          phone, 
          role, 
          trust_level, 
          is_active, 
          created_at, 
          updated_at
        ) VALUES (
          ${phone}, 
          'customer', 
          1, 
          true, 
          NOW(), 
          NOW()
        )
        RETURNING id;
      `;
      customerId = newCustomer[0].id;
    }

    const orderNumber = `KLA-${Date.now().toString().slice(-6)}`;
    const payableAmount = paymentMethod === 'cod' 
      ? Math.round(pricing?.receipt?.codDepositDueNow || 250)
      : Math.round(pricing?.receipt?.finalPayable || 5600);

    const productSubtotal = Math.round(pricing?.receipt?.productSubtotal || 500);
    const deliveryFee = Math.round(pricing?.receipt?.riderDeliveryComponent || 5000);
    const serviceFee = Math.round(pricing?.receipt?.serviceFee || 0);
    const damageFee = Math.round(pricing?.receipt?.damageProtectionFee || 16);

    console.log(`[Order API] Inserting order ${orderNumber} (status: awaiting_payment) for UGX ${payableAmount}...`);

    // 3. Insert Order with status: 'awaiting_payment'
    const insertedOrder = await sql`
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
        created_at
      ) VALUES (
        ${orderNumber},
        ${customerId},
        ${vendorId},
        ${slotStart ? 'scheduled' : 'asap'},
        'awaiting_payment',
        ${productSubtotal},
        ${deliveryFee},
        ${serviceFee},
        ${damageFee},
        0,
        ${payableAmount},
        ${paymentMethod || 'momo'},
        NOW()
      )
      RETURNING id, order_number;
    `;

    const orderRecord = insertedOrder[0];
    console.log('[Order API] Order recorded:', orderRecord.id);

    // 4. Request Pesapal Live Gateway Session
    console.log('[Order API] Requesting Pesapal Live session...');
    const token = await getPesapalToken();

    const pesapalPayload = {
      id: orderNumber,
      currency: 'UGX',
      amount: payableAmount,
      description: `Order ${orderNumber} - Kampala Food Retail`,
      callback_url: process.env.PESAPAL_CALLBACK_URL || 'https://retail.techaus.online/payment/callback',
      notification_id: process.env.PESAPAL_IPN_ID,
      billing_address: {
        email_address: customerDetails?.email || 'sarah.namu@gmail.com',
        phone_number: phone,
        first_name: customerDetails?.name?.split(' ')[0] || 'Sarah',
        last_name: customerDetails?.name?.split(' ')[1] || 'Namubiru',
        line_1: 'Ntinda Roastery Corridor',
        city: 'Kampala',
        country_code: 'UG',
      },
    };

    const baseUrl = process.env.PESAPAL_BASE_URL || 'https://pay.pesapal.com/v3/api';
    const submitRes = await fetch(`${baseUrl}/Transactions/SubmitOrderRequest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(pesapalPayload),
      signal: AbortSignal.timeout(12000),
    });

    const submitText = await submitRes.text();
    if (!submitRes.ok) {
      throw new Error(`Pesapal SubmitOrder failed [HTTP ${submitRes.status}]: ${submitText}`);
    }

    const submitData = JSON.parse(submitText);
    console.log('[Order API] Pesapal session created:', submitData);

    // 5. Insert Pending Payment Record
    await sql`
      INSERT INTO payments (
        order_id,
        merchant_ref,
        provider_ref,
        amount,
        currency,
        status,
        payment_method,
        raw_payload,
        created_at,
        updated_at
      ) VALUES (
        ${orderRecord.id},
        ${orderNumber},
        ${submitData.order_tracking_id || `TRK-${Date.now()}`},
        ${payableAmount},
        'UGX',
        'pending',
        ${paymentMethod || 'momo'},
        ${JSON.stringify(submitData)},
        NOW(),
        NOW()
      );
    `;

    return NextResponse.json({
      success: true,
      orderId: orderRecord.id,
      orderNumber,
      redirectUrl: submitData.redirect_url,
    });
  } catch (error: any) {
    console.error('[Order API Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
