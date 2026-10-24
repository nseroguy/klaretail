import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, users, payments } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    }

    let riderData = null;
    if (order.riderId) {
      const [riderUser] = await db
        .select({
          id: users.id,
          phone: users.phone,
        })
        .from(users)
        .where(eq(users.id, order.riderId))
        .limit(1);

      if (riderUser) {
        riderData = {
          id: riderUser.id,
          name: 'Joseph Kato',
          phone: riderUser.phone,
          vehiclePlate: 'UFE 102A',
        };
      }
    }

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .limit(1);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        deliveryPin: (order as any).deliveryPin,
        codAmountDue: (order as any).codAmountDue ?? order.totalAmount,
        createdAt: order.createdAt,
        rider: riderData,
      },
      payment: payment || null,
    });
  } catch (error: any) {
    console.error('[Order Fetch API Error]:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
