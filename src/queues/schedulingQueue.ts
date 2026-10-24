// src/queues/schedulingQueue.ts
import { Queue, Worker, Job } from 'bullmq';
import { Pool } from 'pg';

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

export const scheduledOrderQueue = new Queue('scheduled-orders-dispatch', { connection });

export async function enqueueRiderAssignment(orderId: string, riderAssignAt: Date) {
  const delayMs = Math.max(0, riderAssignAt.getTime() - Date.now());

  await scheduledOrderQueue.add(
    'assign-rider-job',
    { orderId },
    {
      jobId: `assign:${orderId}`,
      delay: delayMs,
      removeOnComplete: true,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );
}

// Assignment worker processing the activation
export function initScheduledOrderWorker(pool: Pool) {
  return new Worker(
    'scheduled-orders-dispatch',
    async (job: Job<{ orderId: string }>) => {
      const { orderId } = job.data;
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Check if order was cancelled prior to execution window
        const orderRes = await client.query(
          `SELECT o.status, s.is_activated 
           FROM orders o 
           JOIN scheduled_orders s ON s.order_id = o.id 
           WHERE o.id = $1 FOR UPDATE`,
          [orderId]
        );

        if (orderRes.rowCount === 0 || orderRes.rows[0].status === 'cancelled') {
          await client.query('ROLLBACK');
          return;
        }

        // 1. Transition state to scheduled_activated
        await client.query(
          `UPDATE orders SET status = 'scheduled_activated' WHERE id = $1`,
          [orderId]
        );
        await client.query(
          `UPDATE scheduled_orders SET is_activated = TRUE WHERE order_id = $1`,
          [orderId]
        );

        await client.query('COMMIT');

        // 2. Trigger rider matching engine
        await dispatchToAvailableRiders(orderId);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    { connection, concurrency: 10 }
  );
}

async function dispatchToAvailableRiders(orderId: string) {
  // Dispatches 30s offer to eligible riders within 3km zone
  console.log(`[RiderMatch] Dispatched dispatch request for order: ${orderId}`);
}