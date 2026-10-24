import { NextRequest, NextResponse } from 'next/server';
import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { deliverySlots, vendors } from '@/db/schema';
import { TimeSlot } from '@/types/slots';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vendorId = searchParams.get('vendorId');
  const dateStr = searchParams.get('date'); // YYYY-MM-DD

  if (!vendorId || !dateStr) {
    return NextResponse.json({ error: 'vendorId and date are required parameters' }, { status: 400 });
  }

  // 1. Fetch vendor default capacity & profile
  const vendor = await db.query.vendors.findFirst({
    where: eq(vendors.id, vendorId),
  });

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }

  // 2. Bound operational hours (e.g. 08:00 to 22:00 EAT -> UTC+3)
  const dayStart = new Date(`${dateStr}T08:00:00+03:00`);
  const dayEnd = new Date(`${dateStr}T22:00:00+03:00`);

  // 3. Query existing booked slot rows within day window
  const existingSlots = await db
    .select()
    .from(deliverySlots)
    .where(
      and(
        eq(deliverySlots.vendorId, vendorId),
        gte(deliverySlots.slotStart, dayStart),
        lte(deliverySlots.slotStart, dayEnd)
      )
    );

  const slotMap = new Map<string, typeof deliverySlots.$inferSelect>();
  existingSlots.forEach((slot) => {
    slotMap.set(slot.slotStart.toISOString(), slot);
  });

  // 4. Generate all discrete 15-minute intervals
  const slots: TimeSlot[] = [];
  const current = new Date(dayStart);

  while (current < dayEnd) {
    const slotStartIso = current.toISOString();
    const slotEnd = new Date(current.getTime() + 15 * 60 * 1000);
    const existing = slotMap.get(slotStartIso);

    const booked = existing ? existing.booked : 0;
    const capacity = existing ? existing.capacity : vendor.defaultSlotCapacity;
    const isFull = booked >= capacity;

    slots.push({
      slotStart: slotStartIso,
      slotEnd: slotEnd.toISOString(),
      capacity,
      booked,
      status: existing?.status === 'closed' ? 'closed' : isFull ? 'full' : 'open',
    });

    current.setMinutes(current.getMinutes() + 15);
  }

  return NextResponse.json({ slots });
}