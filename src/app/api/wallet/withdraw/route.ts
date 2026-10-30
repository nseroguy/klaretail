// src/app/api/wallet/withdraw/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { wallets, walletLedger } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';

export async function POST(req: NextRequest) {
  try {
    const rawCookie = req.cookies.get('staff_session')?.value || req.cookies.get('session_token')?.value;
    if (!rawCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    let session: any;
    try {
      let dec = rawCookie;
      while (dec.includes('%')) dec = decodeURIComponent(dec);
      session = JSON.parse(dec);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid session' }, { status: 401 });
    }

    const { amount, destinationPhone, channel = 'MTN_MOMO' } = await req.json();
    const withdrawAmount = Number(amount);

    if (!withdrawAmount || withdrawAmount < 5000) {
      return NextResponse.json({ 
        success: false, 
        message: 'Minimum withdrawal is UGX 5,000.' 
      }, { status: 400 });
    }

    // Atomic Balance Lock and Hold Execution
    const result = await db.transaction(async (tx: any) => {
      // 1. Fetch wallet with lock
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, session.id || session.userId))
        .for('update');

      if (!wallet || wallet.balance < withdrawAmount) {
        throw new Error('Insufficient wallet balance.');
      }

      const newBalance = wallet.balance - withdrawAmount;
      const newHeldFloat = wallet.heldFloat + withdrawAmount;

      // 2. Update wallet balances
      await tx
        .update(wallets)
        .set({
          balance: newBalance,
          heldFloat: newHeldFloat,
        })
        .where(eq(wallets.id, wallet.id));

      // 3. Record in append-only ledger
      const [ledgerEntry] = await tx
        .insert(walletLedger).values({
          walletId: wallet.id,
          entryType: 'PAYOUT_HOLD',
          amount: -withdrawAmount,
          balanceAfter: newBalance,
          metadata: {
            destinationPhone,
            channel,
            requestedAt: new Date().toISOString(),
          },
        } as any).returning();

      return { wallet, ledgerEntry };
    });

    // 4. Trigger asynchronous gateway disbursement
    // (e.g. Call Pesapal API v3 / Openfloat payout worker with result.ledgerEntry.id)

    return NextResponse.json({
      success: true,
      message: `Withdrawal request for UGX ${withdrawAmount.toLocaleString()} submitted.`,
      reference: result.ledgerEntry.id,
      remainingBalance: result.wallet.balance - withdrawAmount,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
}