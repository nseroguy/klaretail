import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { users, wallets, walletLedger } from '@/db/schema';
import { eq } from 'drizzle-orm';
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

    const { amount, reference, channel = 'CASH_OFFICE', riderId: explicitRiderId } = await request.json();
    const remittanceAmount = Number(amount);

    if (!remittanceAmount || remittanceAmount <= 0) {
      return NextResponse.json({ success: false, message: 'A positive remittance amount is required.' }, { status: 400 });
    }

    const targetUserId = explicitRiderId || session?.id || session?.userId;

    // 1. Fetch courier profile
    const [riderUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!riderUser || riderUser.role !== 'rider') {
      return NextResponse.json({ success: false, message: 'Courier profile not found.' }, { status: 404 });
    }

    let [riderWallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, riderUser.id))
      .limit(1);

    if (!riderWallet) {
      const [created] = await db
        .insert(wallets)
        .values({ userId: riderUser.id, balance: 0, heldFloat: 0 })
        .returning();
      riderWallet = created;
    }

    const currentBalance = riderWallet.balance || 0;
    const newBalance = currentBalance + remittanceAmount;

    // 2. Atomic settlement update
    await db.transaction(async (tx) => {
      await tx
        .update(wallets)
        .set({ balance: newBalance })
        .where(eq(wallets.id, riderWallet.id));

      await tx.insert(walletLedger).values({
        walletId: riderWallet.id,
        entryType: 'cod_deposit_hold',
        amount: remittanceAmount,
        balanceAfter: newBalance,
        metadata: {
          channel,
          reference: reference || `REMIT-${Date.now()}`,
          notes: `Courier cash remittance of UGX ${remittanceAmount.toLocaleString()} via ${channel}`,
        },
      });

      await logPlatformAudit({
        request,
        action: 'COURIER_CASH_REMITTED',
        targetEntity: 'wallets',
        targetId: riderWallet.id,
        actorId: session?.id || 'system',
        actorRole: session?.role || 'rider',
        metadata: {
          courierPhone: riderUser.phone,
          remittedAmount: remittanceAmount,
          previousBalance: currentBalance,
          newBalance,
          channel,
          reference: reference || `REMIT-${Date.now()}`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Successfully remitted UGX ${remittanceAmount.toLocaleString()}.`,
      previousBalance: currentBalance,
      remittedAmount: remittanceAmount,
      remainingBalance: newBalance,
      courierPhone: riderUser.phone,
    });
  } catch (error: any) {
    console.error('Remittance processing failed:', error);
    return NextResponse.json({ success: false, message: error.message || 'Remittance processing failed.' }, { status: 500 });
  }
}
