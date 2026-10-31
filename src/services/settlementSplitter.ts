import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function applyCreditRepaymentSweep(vendorId: string, grossSettlementAmount: number) {
  const tranches: any = await db.execute(sql`
    SELECT id, total_due, settled_amount
    FROM credit_tranches
    WHERE vendor_id = ${vendorId}::uuid AND status = 'active'
    ORDER BY due_date ASC
    LIMIT 1;
  `);

  const activeTranche = Array.isArray(tranches) ? tranches[0] : tranches?.rows?.[0];
  if (!activeTranche) {
    return { netMerchantPayout: grossSettlementAmount, creditDeducted: 0 };
  }

  const remainingDue = Number(activeTranche.total_due) - Number(activeTranche.settled_amount);
  const targetSweep = Math.min(remainingDue, grossSettlementAmount * 0.20);

  if (targetSweep > 0) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE credit_tranches
        SET settled_amount = settled_amount + ${targetSweep},
            status = CASE WHEN settled_amount + ${targetSweep} >= total_due THEN 'settled'::credit_tranche_status ELSE 'active'::credit_tranche_status END
        WHERE id = ${activeTranche.id};
      `);

      await tx.execute(sql`
        UPDATE vendor_credit_facilities
        SET available_credit = available_credit + ${targetSweep},
            drawn_amount = drawn_amount - ${targetSweep}
        WHERE vendor_id = ${vendorId}::uuid;
      `);
    });
  }

  return {
    netMerchantPayout: grossSettlementAmount - targetSweep,
    creditDeducted: targetSweep,
  };
}
