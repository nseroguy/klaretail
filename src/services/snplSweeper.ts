import { db } from '@/db';
import { sql } from 'drizzle-orm';

export interface SweepResult {
  swept: boolean;
  amountSwept: number;
  appliedToPoNumber: string | null;
  remainingPoBalance: number;
}

export async function executeSnplDailyMicroSweep(
  retailVendorId: string,
  b2cOrderId: string,
  settledOrderAmountUgx: number,
  sweepRatePercent: number = 15.0
): Promise<SweepResult> {
  const activePoQuery: any = await db.execute(sql`
    SELECT id, order_number, COALESCE(snpl_adjusted_principal, total_amount) AS total_debt
    FROM b2b_purchase_orders
    WHERE retail_vendor_id = ${retailVendorId}::uuid
      AND status = 'DELIVERED_AND_RECEIVED'
      AND payment_terms = 'SNPL_14D'
    ORDER BY created_at ASC
    LIMIT 1
  `);

  const activePo = activePoQuery.rows?.[0] || activePoQuery[0];

  if (!activePo) {
    return {
      swept: false,
      amountSwept: 0,
      appliedToPoNumber: null,
      remainingPoBalance: 0,
    };
  }

  const sweepHistoryQuery: any = await db.execute(sql`
    SELECT COALESCE(SUM(amount_swept), 0) AS total_repaid
    FROM snpl_daily_sweeps
    WHERE purchase_order_id = ${activePo.id}::uuid
  `);

  const totalRepaid = Number(sweepHistoryQuery.rows?.[0]?.total_repaid || 0);
  const totalDebt = Number(activePo.total_debt);
  const outstandingBalance = Math.max(0, totalDebt - totalRepaid);

  if (outstandingBalance <= 0) {
    return {
      swept: false,
      amountSwept: 0,
      appliedToPoNumber: activePo.order_number,
      remainingPoBalance: 0,
    };
  }

  const targetSweep = (settledOrderAmountUgx * sweepRatePercent) / 100;
  const actualSweepAmount = Math.min(outstandingBalance, targetSweep);
  const newRemainingBalance = outstandingBalance - actualSweepAmount;

  await db.execute(sql`
    INSERT INTO snpl_daily_sweeps (
      purchase_order_id,
      retail_vendor_id,
      source_order_id,
      sweep_percentage,
      amount_swept,
      remaining_balance,
      created_at
    ) VALUES (
      ${activePo.id}::uuid,
      ${retailVendorId}::uuid,
      ${b2cOrderId}::uuid,
      ${sweepRatePercent},
      ${actualSweepAmount},
      ${newRemainingBalance},
      NOW()
    )
  `);

  return {
    swept: true,
    amountSwept: actualSweepAmount,
    appliedToPoNumber: activePo.order_number,
    remainingPoBalance: newRemainingBalance,
  };
}
