import { createDbClient } from "@/db";
// src/services/slotService.ts
import { sql, eq, and, lt } from 'drizzle-orm';
import { deliverySlots, scheduledOrders, orders } from '../db/schema';

export async function bookSlotDrizzle(
  db: ReturnType<typeof createDbClient>,
  params: {
    vendorId: string;
    slotStart: Date;
    orderId: string;
    prepMinutes?: number;
    transitMinutes?: number;
  }
) {
  const prep = params.prepMinutes ?? 30;
  const transit = params.transitMinutes ?? 20;

  const slotEnd = new Date(params.slotStart.getTime() + 15 * 60 * 1000);
  const prepBy = new Date(params.slotStart.getTime() - (prep + transit) * 60 * 1000);
  const riderAssignAt = new Date(params.slotStart.getTime() - 25 * 60 * 1000);
  const cancellationDeadline = new Date(params.slotStart.getTime() - 60 * 60 * 1000);

  return await db.transaction(async (tx: any) => {
    // 1. Atomic Upsert with Capacity Guard
    const reservedSlot = await tx
      .insert(deliverySlots)
      .values({
        vendorId: params.vendorId,
        slotStart: params.slotStart,
        slotEnd: slotEnd,
        capacity: 5,
        booked: 1,
        status: 'open',
      })
      .onConflictDoUpdate({
        target: [deliverySlots.vendorId, deliverySlots.slotStart],
        set: {
          booked: sql`${deliverySlots.booked} + 1`,
          status: sql`CASE 
            WHEN ${deliverySlots.booked} + 1 >= ${deliverySlots.capacity} THEN 'full'::slot_status 
            ELSE 'open'::slot_status 
          END`,
        },
        where: and(
          lt(deliverySlots.booked, deliverySlots.capacity),
          eq(deliverySlots.status, 'open')
        ),
      })
      .returning();

    if (!reservedSlot || reservedSlot.length === 0) {
      throw new Error('SLOT_CAPACITY_EXCEEDED');
    }

    const slot = reservedSlot[0];

    // 2. Link Scheduled Order Record
    await tx.insert(scheduledOrders).values({
      orderId: params.orderId,
      slotId: slot.id,
      scheduledFor: params.slotStart,
      prepBy: prepBy,
      riderAssignAt: riderAssignAt,
      cancellationDeadline: cancellationDeadline,
      isActivated: false,
    });

    // 3. Mark Base Order Confirmed
    await tx
      .update(orders)
      .set({ status: 'scheduled_confirmed' })
      .where(eq(orders.id, params.orderId));

    return {
      slotId: slot.id,
      riderAssignAt,
      prepBy,
    };
  });
}