import { db } from '../db';
import { wallets, walletLedger, users } from '../db/schema';
import { eq, lt, and, desc } from 'drizzle-orm';

const PLATFORM_ADMIN_USER_ID = '10000000-0000-0000-0000-000000000003';
const DAILY_DEMURRAGE_RATE = 0.009; // 0.9% daily penalty
const GRACE_PERIOD_MS = 72 * 60 * 60 * 1000; // 72 Hours in ms

export async function processOverdueDemurrage() {
  console.log("=== EXECUTING 72-HOUR COD DEMURRAGE PENALTY ENGINE ===");

  // 1. Fetch courier wallets holding physical cash debt
  const overdueWallets = await db
    .select({
      walletId: wallets.id,
      userId: wallets.userId,
      balance: wallets.balance,
      userRole: users.role,
      userPhone: users.phone,
    })
    .from(wallets)
    .innerJoin(users, eq(wallets.userId, users.id))
    .where(and(eq(users.role, 'rider'), lt(wallets.balance, 0)));

  console.log(`Auditing ${overdueWallets.length} active couriers carrying COD debt...`);

  const now = Date.now();

  for (const courier of overdueWallets) {
    // 2. Fetch the most recent cash collection or remittance
    const [latestCodCollection] = await db
      .select()
      .from(walletLedger)
      .where(
        and(
          eq(walletLedger.walletId, courier.walletId),
          eq(walletLedger.entryType, 'cod_cash_collected')
        )
      )
      .orderBy(desc(walletLedger.createdAt))
      .limit(1);

    if (!latestCodCollection || !latestCodCollection.createdAt) continue;

    const collectionTime = new Date(latestCodCollection.createdAt).getTime();
    const timeElapsedMs = now - collectionTime;

    if (timeElapsedMs > GRACE_PERIOD_MS) {
      const daysOverdue = Math.floor((timeElapsedMs - GRACE_PERIOD_MS) / (24 * 60 * 60 * 1000)) + 1;
      const principalDebt = Math.abs(courier.balance);
      const dailyPenalty = Math.round(principalDebt * DAILY_DEMURRAGE_RATE);

      if (dailyPenalty <= 0) continue;

      console.log(`[ALERT] Courier ${courier.userPhone} has overdue debt of UGX ${principalDebt.toLocaleString()} (${daysOverdue} days past 72hr grace).`);
      console.log(`Applying 0.9% penalty: UGX ${dailyPenalty.toLocaleString()}...`);

      await db.transaction(async (tx) => {
        const newBalance = courier.balance - dailyPenalty;

        // Debit courier wallet
        await tx
          .update(wallets)
          .set({ balance: newBalance })
          .where(eq(wallets.id, courier.walletId));

        // Insert audit penalty ledger
        await tx.insert(walletLedger).values({
          walletId: courier.walletId,
          entryType: 'refusal_fee_debit',
          amount: -dailyPenalty,
          balanceAfter: newBalance,
          metadata: {
            reason: '72hr_cod_demurrage_penalty',
            rate: '0.9%',
            principalDebt,
            daysOverdue,
            notes: `0.9% daily overdue penalty for UGX ${principalDebt.toLocaleString()} unremitted past 72 hours`,
          },
        });

        // Credit Master Platform Treasury
        const [platformWallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.userId, PLATFORM_ADMIN_USER_ID))
          .limit(1);

        if (platformWallet) {
          const newPlatformBal = platformWallet.balance + dailyPenalty;
          await tx
            .update(wallets)
            .set({ balance: newPlatformBal })
            .where(eq(wallets.id, platformWallet.id));

          await tx.insert(walletLedger).values({
            walletId: platformWallet.id,
            entryType: 'platform_commission',
            amount: dailyPenalty,
            balanceAfter: newPlatformBal,
            metadata: {
              source: 'overdue_cod_demurrage',
              courierId: courier.userId,
              notes: `Realized 0.9% overdue remittance fee from courier ${courier.userPhone}`,
            },
          });
        }
      });

      console.log(`[✓] Penalty recorded. New rider balance: UGX ${(courier.balance - dailyPenalty).toLocaleString()}`);
    }
  }

  console.log("=== DEMURRAGE ENGINE AUDIT COMPLETED ===");
}

if (require.main === module) {
  processOverdueDemurrage()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
