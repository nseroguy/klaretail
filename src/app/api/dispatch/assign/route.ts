import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const { orderId, riderId } = await req.json();

    if (!orderId || !riderId) {
      return NextResponse.json({ success: false, message: 'Missing orderId or riderId' }, { status: 400 });
    }

    await db
      .update(orders)
      .set({
        riderId,
        status: 'accepted',
      } as any)
      .where(eq(orders.id, orderId));

    return NextResponse.json({ success: true, message: 'Rider manually assigned.' });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
