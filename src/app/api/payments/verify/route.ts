import { NextRequest, NextResponse } from 'next/server';
import dns from 'node:dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '@/db/schema';
import { eq, or } from 'drizzle-orm';

neonConfig.webSocketConstructor = ws;

let conn = process.env.DATABASE_URL || '';
if (conn.includes('-pooler')) conn = conn.replace('-pooler', '');

const pool = new Pool({ connectionString: conn });
const db = drizzle(pool, { schema });

async function resolveVerification(merchantRef?: string | null, trackingId?: string | null) {
  if (!merchantRef && !trackingId) {
    return { error: 'Missing merchant reference or tracking ID', status: 400 };
  }

  // Query payments using select() rather than db.query to avoid extra relational overhead
  const paymentRecords = await db
    .select({
      id: schema.payments.id,
      orderId: schema.payments.orderId,
      merchantRef: schema.payments.merchantRef,
      providerRef: schema.payments.providerRef,
      status: schema.payments.status,
      amount: schema.payments.amount,
      paymentMethod: schema.payments.paymentMethod,
    })
    .from(schema.payments)
    .where(
      merchantRef && trackingId
        ? or(
            eq(schema.payments.merchantRef, merchantRef),
            eq(schema.payments.providerRef, trackingId)
          )
        : merchantRef
        ? eq(schema.payments.merchantRef, merchantRef)
        : eq(schema.payments.providerRef, trackingId!)
    )
    .limit(1);

  if (paymentRecords.length === 0) {
    return {
      success: true,
      status: 'pending',
      message: 'Payment received; reconciling transaction ledger...',
    };
  }

  const paymentRecord = paymentRecords[0];

  const orderRecords = await db
    .select({
      id: schema.orders.id,
      orderNumber: schema.orders.orderNumber,
      status: schema.orders.status,
      totalAmount: schema.orders.totalAmount,
      createdAt: schema.orders.createdAt,
    })
    .from(schema.orders)
    .where(eq(schema.orders.id, paymentRecord.orderId))
    .limit(1);

  const orderRecord = orderRecords[0] || null;
  const isComplete = paymentRecord.status === 'completed' || orderRecord?.status === 'paid';

  return {
    success: true,
    status: isComplete ? 'paid' : paymentRecord.status,
    order: orderRecord,
    payment: paymentRecord,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderTrackingId = searchParams.get('orderTrackingId') || searchParams.get('OrderTrackingId');
  const merchantReference = searchParams.get('merchantReference') || searchParams.get('OrderMerchantReference');

  try {
    const result: any = await resolveVerification(merchantReference, orderTrackingId);
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Verify API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server verification error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const merchantReference = body.orderNumber || body.merchantReference || body.OrderMerchantReference;
    const orderTrackingId = body.trackingId || body.orderTrackingId || body.OrderTrackingId;

    const result: any = await resolveVerification(merchantReference, orderTrackingId);
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Verify API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server verification error' },
      { status: 500 }
    );
  }
}
