import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { wallets, walletLedger } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { reference, status, failureReason } = await req.json();

    if (!reference || !status) {
      return NextResponse.json({ success: false, message: 'Missing reference or status' }, { status: 400 });
    }

    await db.transaction(async (tx: any) => {
      const [holdEntry]: any = await tx
        .select()
        .from(walletLedger)
        .where(eq(walletLedger.id, reference));

      if (!holdEntry) return;

      const [targetWallet]: any = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.id, holdEntry.walletId))
        .for('update');

      if (!targetWallet) return;

      const payoutAmount = Math.abs(Number(holdEntry.amount));

      if (status === 'COMPLETED' || status === 'SUCCESS') {
        await tx.update(wallets)
          .set({ heldFloat: sql`held_float - ${payoutAmount}` })
          .where(eq(wallets.id, targetWallet.id));

        await tx.insert(walletLedger).values({
          walletId: targetWallet.id,
          entryType: 'PAYOUT_DISBURSED',
          amount: 0,
          balanceAfter: targetWallet.balance,
          metadata: { holdReference: reference, status: 'COMPLETED' },
        } as any);
      } else if (status === 'FAILED' || status === 'REVERSED') {
        await tx.update(wallets)
          .set({
            balance: sql`balance + ${payoutAmount}`,
            heldFloat: sql`held_float - ${payoutAmount}`,
          })
          .where(eq(wallets.id, targetWallet.id));

        await tx.insert(walletLedger).values({
          walletId: targetWallet.id,
          entryType: 'PAYOUT_REVERSED',
          amount: payoutAmount,
          balanceAfter: Number(targetWallet.balance) + payoutAmount,
          metadata: { holdReference: reference, reason: failureReason || 'Disbursement failed' },
        } as any);
      }
    });

    return NextResponse.json({ success: true, received: true });
  } catch (error: any) {
    console.error('[PAYOUT_STATUS_WEBHOOK_ERR]:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
