// src/queue/producer.ts
export interface DispatchPayload {
  orderId: string;
  orderNumber: string;
  vendorId: string;
  dropoffCoordinates: {
    latitude: number;
    longitude: number;
  };
  pickupCoordinates: {
    latitude: number;
    longitude: number;
  };
  scheduledAt: string;
}

export interface Env {
  DISPATCH_QUEUE: Queue<DispatchPayload>;
  DATABASE_URL: string;
}

/**
 * Schedules rider assignment after an intentional kitchen prep delay.
 *
 * @param queue Cloudflare Queue producer binding
 * @param payload Order details and routing geometry
 * @param delaySeconds Time to wait before making the message available to consumers (default 300s = 5m)
 */
export async function scheduleRiderDispatch(
  queue: Queue<DispatchPayload>,
  payload: DispatchPayload,
  delaySeconds = 300
): Promise<void> {
  await queue.send(payload, {
    delaySeconds, // Cloudflare Queues message delay
  });

  console.log(
    `[Dispatch Queue] Enqueued order ${payload.orderNumber} for rider assignment with a ${delaySeconds}s delay.`
  );
}