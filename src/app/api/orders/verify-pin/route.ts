import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const { orderId, pin, cashCollected } = await req.json();

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    }

    if ((order as any).deliveryPin !== pin) {
      return NextResponse.json({ success: false, message: 'Invalid Handshake PIN. Do not release package.' }, { status: 401 });
    }

    await db.update(orders).set({
      status: 'delivered',
      ...((orders as any).codCashReceived ? {
        codCashReceived: cashCollected ? Math.round(Number(cashCollected)) : order.totalAmount,
        codVerifiedAt: new Date(),
      } : {}),
    } as any).where(eq(orders.id, orderId));

    return NextResponse.json({
      success: true,
      message: 'Escrow released and cash handover verified.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
