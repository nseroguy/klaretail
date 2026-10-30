import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawCookie = request.cookies.get('staff_session')?.value;
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

    const { amount, reference, channel = 'CASH_OFFICE', riderId: explicitRiderId, phone: explicitPhone } = await request.json();
    const remittanceAmount = Number(amount);

    if (!remittanceAmount || remittanceAmount <= 0) {
      return NextResponse.json({ success: false, message: 'A positive remittance amount is required.' }, { status: 400 });
    }

    const targetPhone = explicitPhone || session?.phone;
    const targetId = explicitRiderId || session?.id || session?.userId;

    // 1. Fetch courier profile from riders registry
    const riderRes: any = await db.execute(sql`
      SELECT 
        id::text AS id,
        name,
        phone,
        COALESCE(wallet_balance, 0.00)::numeric AS "walletBalance",
        COALESCE(max_cash_limit, 50000.00)::numeric AS "maxCashLimit",
        is_locked AS "isLocked",
        is_available AS "isAvailable"
      FROM riders
      WHERE id = ${targetId}::uuid OR phone = ${targetPhone || ''}::text
      LIMIT 1;
    `);

    const rider = Array.isArray(riderRes) ? riderRes[0] : riderRes?.rows?.[0];

    if (!rider) {
      return NextResponse.json({ success: false, message: 'Courier profile not found in riders registry.' }, { status: 404 });
    }

    const currentBalance = Number(rider.walletBalance || 0);
    const maxLimit = Number(rider.maxCashLimit || 50000.00);
    const newBalance = Math.max(0, currentBalance - remittanceAmount);
    const shouldUnlock = newBalance < maxLimit;

    // 2. Clear cash float and restore courier availability
    const updatedRes: any = await db.execute(sql`
      UPDATE riders
      SET 
        wallet_balance = ${newBalance},
        is_locked = CASE WHEN ${shouldUnlock} THEN false ELSE is_locked END,
        is_available = CASE WHEN ${shouldUnlock} THEN true ELSE is_available END,
        updated_at = NOW()
      WHERE id = ${rider.id}::uuid
      RETURNING 
        id::text AS id, 
        wallet_balance::numeric AS "walletBalance", 
        is_locked AS "isLocked", 
        is_available AS "isAvailable";
    `);

    const updatedRider = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes?.rows?.[0];

    await logPlatformAudit({
      request,
      action: 'COURIER_CASH_REMITTED',
      targetEntity: 'riders',
      targetId: rider.id,
      actorId: session?.id || 'system',
      actorRole: session?.role || 'staff',
      metadata: {
        courierPhone: rider.phone,
        remittedAmount: remittanceAmount,
        previousBalance: currentBalance,
        newBalance,
        channel,
        reference: reference || `REMIT-${Date.now()}`
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully remitted UGX ${remittanceAmount.toLocaleString()}. Courier float cleared.`,
      courier: rider.name,
      previousBalance: currentBalance,
      remittedAmount: remittanceAmount,
      remainingBalance: newBalance,
      isLocked: updatedRider?.isLocked ?? false,
      isAvailable: updatedRider?.isAvailable ?? true
    });
  } catch (error: any) {
    console.error('Remittance processing failed:', error);
    return NextResponse.json({ success: false, message: error.message || 'Remittance processing failed.' }, { status: 500 });
  }
}
