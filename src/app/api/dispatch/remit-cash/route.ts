import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
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

    const { amount, reference, channel = 'CASH_OFFICE' } = await request.json();
    const remittanceAmount = Number(amount);

    if (!remittanceAmount || remittanceAmount <= 0) {
      return NextResponse.json({ success: false, message: 'A positive remittance amount is required.' }, { status: 400 });
    }

    const phone = session?.phone;
    const userId = session?.id;

    // 1. Fetch courier profile
    const riderResult: any = await db.execute(sql`
      SELECT id::text AS id, name, phone, wallet_balance::numeric AS "walletBalance"
      FROM riders
      WHERE TRIM(phone) = ${phone.trim()}::text
      LIMIT 1
    `);
    const rider = Array.isArray(riderResult) ? riderResult[0] : riderResult?.rows?.[0];

    if (!rider) {
      return NextResponse.json({ success: false, message: 'Courier profile not found.' }, { status: 404 });
    }

    const currentBalance = Number(rider.walletBalance);
    if (remittanceAmount > currentBalance) {
      return NextResponse.json({
        success: false,
        message: `Remittance amount (UGX ${remittanceAmount.toLocaleString()}) exceeds current cash-on-hand (UGX ${currentBalance.toLocaleString()}).`
      }, { status: 422 });
    }

    // 2. Atomic settlement update
    const updatedRiderResult: any = await db.execute(sql`
      UPDATE riders
      SET wallet_balance = wallet_balance - ${remittanceAmount},
          updated_at = NOW()
      WHERE id = ${rider.id}::uuid
      RETURNING wallet_balance::numeric AS "newWalletBalance"
    `);

    const newBalance = Array.isArray(updatedRiderResult) 
      ? updatedRiderResult[0]?.newWalletBalance 
      : updatedRiderResult?.rows?.[0]?.newWalletBalance;

    // 3. Record audit log
    await logPlatformAudit({
      request,
      action: 'COURIER_CASH_REMITTED',
      targetEntity: 'riders',
      targetId: rider.id,
      actorId: userId,
      actorRole: 'rider',
      metadata: {
        courier: rider.name,
        remittedAmount: remittanceAmount,
        previousBalance: currentBalance,
        newBalance: Number(newBalance),
        channel,
        reference: reference || `REMIT-${Date.now()}`
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully remitted UGX ${remittanceAmount.toLocaleString()}.`,
      previousBalance: currentBalance,
      remittedAmount: remittanceAmount,
      remainingBalance: Number(newBalance),
      courier: rider.name
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Remittance processing failed.' }, { status: 500 });
  }
}
