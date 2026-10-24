import { NextRequest, NextResponse } from 'next/server';
import dns from 'node:dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

import { neon } from '@neondatabase/serverless';

function getDb() {
  const conn = (process.env.DATABASE_URL || '').replace('-pooler', '');
  return neon(conn);
}

// Handle HEAD and GET healthchecks / Pesapal validation pings
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderTrackingId = searchParams.get('OrderTrackingId');
  const orderMerchantReference = searchParams.get('OrderMerchantReference');

  return NextResponse.json({
    status: 'active',
    endpoint: 'pesapal_ipn',
    received: { orderTrackingId, orderMerchantReference },
  });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}

// Handle Pesapal IPN POST notifications
export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      const text = await req.text();
      body = text ? JSON.parse(text) : {};
    }

    const orderTrackingId = body.OrderTrackingId || body.orderNotificationType;
    const merchantReference = body.OrderMerchantReference;

    console.log('🔔 Received Pesapal Webhook Notification:', {
      orderTrackingId,
      merchantReference,
      body,
    });

    if (merchantReference) {
      const sql = getDb();

      // 1. Update payments table: payments has updated_at
      await sql`
        UPDATE payments 
        SET status = 'completed'::payment_status, updated_at = NOW() 
        WHERE merchant_ref = ${merchantReference};
      `;

      // 2. Update orders table: orders does NOT have updated_at
      const updatedOrders = await sql`
        UPDATE orders 
        SET status = 'paid'::order_status 
        WHERE order_number = ${merchantReference}
        RETURNING id, order_number;
      `;

      const resolvedOrder = updatedOrders[0];

      // 3. Trigger Cloudflare Queue delayed dispatch worker
      const dispatchWorkerUrl = process.env.DISPATCH_WORKER_URL || 'http://127.0.0.1:8787';

      try {
        fetch(`${dispatchWorkerUrl}/dispatch/enqueue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: resolvedOrder?.id,
            orderNumber: merchantReference,
            vendorId: 'vendor_central_01',
            pickupCoordinates: { latitude: 0.3136, longitude: 32.5811 }, // Kampala Central
            dropoffCoordinates: { latitude: 0.3476, longitude: 32.5825 },
            delaySeconds: 300, // Production 5-minute kitchen prep buffer
          }),
        }).catch((err) => {
          console.error('[Queue Trigger Network Error]:', err.message);
        });
      } catch (queueErr) {
        console.error('[Failed to enqueue rider dispatch]:', queueErr);
      }
    }

    return NextResponse.json({
      orderNotificationType: 'IPNCHANGE',
      orderTrackingId: orderTrackingId || '',
      orderMerchantReference: merchantReference || '',
      status: 200,
    });
  } catch (error: any) {
    console.error('Pesapal Webhook processing failed:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook internal failure' },
      { status: 500 }
    );
  }
}
