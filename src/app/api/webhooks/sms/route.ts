import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';

export const dynamic = 'force-dynamic';

// Uganda Carrier Network Code mappings
const UG_NETWORKS: Record<string, string> = {
  '64110': 'MTN Uganda',
  '64101': 'Airtel Uganda',
  '64114': 'Lycamobile / Africell',
  '64104': 'Uganda Telecom (UTL)',
};

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let messageId: string | null = null;
    let phoneNumber: string | null = null;
    let status: string | null = null;
    let failureReason: string | null = null;
    let networkCode: string | null = null;
    let rawPayload: any = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      messageId = formData.get('id')?.toString() || null;
      phoneNumber = formData.get('phoneNumber')?.toString() || null;
      status = formData.get('status')?.toString() || null;
      failureReason = formData.get('failureReason')?.toString() || null;
      networkCode = formData.get('networkCode')?.toString() || null;
      formData.forEach((val, key) => {
        rawPayload[key] = val.toString();
      });
    } else {
      rawPayload = await request.json().catch(() => ({}));
      messageId = rawPayload.id || rawPayload.messageId || null;
      phoneNumber = rawPayload.phoneNumber || rawPayload.phone || null;
      status = rawPayload.status || null;
      failureReason = rawPayload.failureReason || null;
      networkCode = rawPayload.networkCode || null;
    }

    if (!messageId || !phoneNumber) {
      return NextResponse.json(
        { success: false, message: 'Invalid payload: id and phoneNumber required.' },
        { status: 400 }
      );
    }

    const carrierName = networkCode ? (UG_NETWORKS[networkCode] || `Network ${networkCode}`) : 'Unknown';

    // 1. Insert delivery report event
    await db.execute(sql`
      INSERT INTO sms_delivery_receipts (
        message_id, phone, status, network_code, failure_reason, raw_payload, received_at
      ) VALUES (
        ${messageId}, 
        ${phoneNumber}, 
        ${status || 'UNKNOWN'}, 
        ${networkCode}, 
        ${failureReason}, 
        ${JSON.stringify(rawPayload)}::jsonb, 
        NOW()
      )
    `);

    // 2. Audit log for visibility in platform monitors
    await logPlatformAudit({
      request,
      action: 'SMS_DELIVERY_RECEIPT',
      targetEntity: 'sms_delivery_receipts',
      targetId: messageId,
      actorId: 'AFRICAS_TALKING_GATEWAY',
      actorRole: 'system',
      metadata: {
        messageId,
        phone: phoneNumber,
        status,
        carrier: carrierName,
        networkCode,
        failureReason,
      },
    });

    console.log(`[AT SMS DLR] MsgID: ${messageId} | Phone: ${phoneNumber} | Carrier: ${carrierName} | Status: ${status}`);

    // Africa's Talking expects standard HTTP 200 OK
    return new NextResponse('OK', { status: 200 });
  } catch (error: any) {
    console.error('[AT SMS DLR ERROR]', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// Allow GET for simple health checking / ping tests from AT dashboard
export async function GET() {
  return NextResponse.json({
    status: 'ACTIVE',
    service: 'KlaRetail SMS Delivery Receipt Gateway',
    timestamp: new Date().toISOString(),
  });
}
