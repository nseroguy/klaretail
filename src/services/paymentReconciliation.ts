// src/services/paymentReconciliation.ts
import { eq, and, lt } from 'drizzle-orm';
import { db } from '@/db';
import { payments, orders, deliverySlots, scheduledOrders } from '@/db/schema';
import { pesapal } from '@/services/pesapal';

export interface ReconciliationSummary {
  checkedCount: number;
  completedCount: number;
  failedCount: number;
  abandonedCount: number;
  errors: Array<{ paymentId: string; merchantRef: string; error: string }>;
}

/**
 * Sweeps stuck pending payments and synchronizes with Pesapal authoritative status.
 */
export async function reconcileStuckPayments(): Promise<ReconciliationSummary> {
  const summary: ReconciliationSummary = {
    checkedCount: 0,
    completedCount: 0,
    failedCount: 0,
    abandonedCount: 0,
    errors: [],
  };

  const now = Date.now();
  const fifteenMinutesAgo = new Date(now - 15 * 60 * 1000);
  const sixtyMinutesAgo = new Date(now - 60 * 60 * 1000);

  // 1. Fetch payments stuck in 'pending' created more than 15 minutes ago
  const stuckPayments = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.status, 'pending'),
        lt(payments.createdAt, fifteenMinutesAgo)
      )
    )
    .limit(100); // Batch cap to preserve edge execution limits

  summary.checkedCount = stuckPayments.length;

  for (const payment of stuckPayments) {
    try {
      // 2. If no provider tracking ref exists (e.g. user aborted before Pesapal redirect)
      if (!payment.providerRef) {
        if (payment.createdAt < sixtyMinutesAgo) {
          await markPaymentAbandoned(payment.id, payment.orderId, 'No gateway tracking ID created within 60 minutes');
          summary.abandonedCount++;
        }
        continue;
      }

      // 3. Query authoritative status from Pesapal API
      const statusData = await pesapal.getTransactionStatus(payment.providerRef);

      if (statusData.payment_status_description === 'Completed') {
        await applySuccessfulPayment(payment.id, payment.orderId, statusData);
        summary.completedCount++;
      } else if (
        statusData.payment_status_description === 'Failed' ||
        statusData.payment_status_description === 'Invalid'
      ) {
        await applyFailedPayment(payment.id, payment.orderId, statusData);
        summary.failedCount++;
      } else if (payment.createdAt < sixtyMinutesAgo) {
        // Uncompleted after 60 minutes -> mark abandoned and release slot
        await markPaymentAbandoned(
          payment.id,
          payment.orderId,
          `Payment unconfirmed after 60 minutes (Pesapal: ${statusData.payment_status_description})`
        );
        summary.abandonedCount++;
      }
    } catch (err: any) {
      console.error(`Reconciliation failed for payment ${payment.id} (${payment.merchantRef}):`, err);
      summary.errors.push({
        paymentId: payment.id,
        merchantRef: payment.merchantRef,
        error: err.message || 'Unknown error',
      });
    }
  }

  return summary;
}

/**
 * Transitions order and payment to completed state.
 */
async function applySuccessfulPayment(paymentId: string, orderId: string, statusData: any) {
  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({
        status: 'completed',
        paymentMethod: statusData.payment_method,
        confirmationCode: statusData.confirmation_code,
        rawPayload: statusData,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));

    const order = await tx.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (order && order.status === 'awaiting_payment') {
      const targetStatus = order.mode === 'scheduled' ? 'scheduled_confirmed' : 'paid';
      await tx
        .update(orders)
        .set({ status: targetStatus })
        .where(eq(orders.id, orderId));
    }
  });
}

/**
 * Transitions order and payment to failed/cancelled state and releases slot if scheduled.
 */
async function applyFailedPayment(paymentId: string, orderId: string, statusData: any) {
  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({
        status: 'failed',
        rawPayload: statusData,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));

    await releaseOrderAndSlot(tx, orderId, 'payment_failed');
  });
}

/**
 * Marks unfulfilled payment abandoned, cancels order, and frees up capacity.
 */
async function markPaymentAbandoned(paymentId: string, orderId: string, reason: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({
        status: 'abandoned',
        rawPayload: { reason, timestamp: new Date().toISOString() },
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));

    await releaseOrderAndSlot(tx, orderId, 'cancelled');
  });
}

/**
 * Helper to update order status and decrement slot capacity if a scheduled slot was reserved.
 */
async function releaseOrderAndSlot(tx: any, orderId: string, targetStatus: 'cancelled' | 'payment_failed') {
  await tx
    .update(orders)
    .set({ status: targetStatus })
    .where(eq(orders.id, orderId));

  // If order had a reserved slot, release slot capacity
  const scheduledOrder = await tx.query.scheduledOrders.findFirst({
    where: eq(scheduledOrders.orderId, orderId),
  });

  if (scheduledOrder) {
    const slot = await tx.query.deliverySlots.findFirst({
      where: eq(deliverySlots.id, scheduledOrder.slotId),
    });

    if (slot && slot.booked > 0) {
      await tx
        .update(deliverySlots)
        .set({
          booked: slot.booked - 1,
          status: 'open',
        })
        .where(eq(deliverySlots.id, slot.id));
    }
  }
}