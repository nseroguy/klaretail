import { db } from '@/db';
import { sql } from 'drizzle-orm';

export interface SplitResult {
  merchantPayout: number;
  snplDeduction: number;
  activeTrancheSettled: boolean;
  trancheId?: string;
  remainingDue?: number;
}

export async function processSNPLSplitSettlement(
  vendorId: string,
  grossSaleAmount: number,
  orderId?: string
): Promise<SplitResult> {
  const saleAmountNum = Number(grossSaleAmount);

  // 1. Fetch active, unpaid credit tranche for this vendor
  const trancheRows: any = await db.execute(sql`
    SELECT id, principal_amount, fee_amount, total_due, settled_amount
    FROM credit_tranches
    WHERE vendor_id = ${vendorId}::uuid
      AND status = 'active'::credit_tranche_status
    ORDER BY due_date ASC
    LIMIT 1
    FOR UPDATE;
  `);

  const tranche = Array.isArray(trancheRows) ? trancheRows[0] : trancheRows?.rows?.[0];

  // If no active tranche, merchant receives 100% of payout
  if (!tranche) {
    return {
      merchantPayout: saleAmountNum,
      snplDeduction: 0,
      activeTrancheSettled: false,
    };
  }

  const totalDue = Number(tranche.total_due);
  const settledAmount = Number(tranche.settled_amount);
  const remainingDue = totalDue - settledAmount;

  // 20% automated sweep rule
  const proposedSweep = Math.round(saleAmountNum * 0.20);
  const actualSweep = Math.min(proposedSweep, remainingDue);
  const merchantPayout = saleAmountNum - actualSweep;

  const newSettled = settledAmount + actualSweep;
  const isSettled = newSettled >= totalDue;

  // 1. Record sweep transaction
  await db.execute(sql`
    INSERT INTO credit_repayment_sweeps (
      tranche_id, order_id, sweep_amount, sweep_source, created_at
    ) VALUES (
      ${tranche.id}::uuid,
      ${orderId ? sql`${orderId}::uuid` : sql`NULL`},
      ${actualSweep},
      'POS_SWEEP',
      NOW()
    );
  `);

  // 2. Update tranche settled balance & status
  await db.execute(sql`
    UPDATE credit_tranches
    SET settled_amount = ${newSettled},
        status = (CASE WHEN ${isSettled} THEN 'settled' ELSE 'active' END)::credit_tranche_status
    WHERE id = ${tranche.id}::uuid;
  `);

  // 3. Replenish available facility limit (capped at credit_limit)
  await db.execute(sql`
    UPDATE vendor_credit_facilities
    SET available_credit = LEAST(credit_limit, available_credit + ${actualSweep}),
        drawn_amount = GREATEST(0, drawn_amount - ${actualSweep})
    WHERE vendor_id = ${vendorId}::uuid;
  `);

  return {
    merchantPayout,
    snplDeduction: actualSweep,
    activeTrancheSettled: isSettled,
    trancheId: tranche.id,
    remainingDue: totalDue - newSettled,
  };
}
