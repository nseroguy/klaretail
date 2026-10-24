import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { orders, payments, users, userProfiles } from '@/db/schema';
import { pesapal } from '@/services/pesapal';

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    // 1. Fetch Order & Customer Details
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        customer: {
          with: {
            profile: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Determine amount payable now (full amount for pesapal, 50% deposit for COD)
    const amountToCharge =
      order.paymentMethod === 'cod'
        ? Math.round(0.5 * order.productSubtotal)
        : order.totalAmount;

    // 2. Submit to Pesapal v3
    const pesapalResponse = await pesapal.submitOrder({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: amountToCharge,
      description: `Payment for Order #${order.orderNumber}`,
      customer: {
        phoneNumber: order.customer.phone,
        firstName: order.customer.profile?.fullName || 'Customer',
      },
    });

    // 3. Upsert Payment Entry
    await db
      .insert(payments)
      .values({
        orderId: order.id,
        merchantRef: order.orderNumber,
        providerRef: pesapalResponse.order_tracking_id,
        amount: amountToCharge,
        currency: 'UGX',
        status: 'pending',
      })
      .onConflictDoUpdate({
        target: [payments.merchantRef],
        set: {
          providerRef: pesapalResponse.order_tracking_id,
          amount: amountToCharge,
          status: 'pending',
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({
      redirectUrl: pesapalResponse.redirect_url,
      orderTrackingId: pesapalResponse.order_tracking_id,
    });
  } catch (error: any) {
    console.error('Pesapal payment initialization error:', error);
    return NextResponse.json(
      { error: error.message || 'Payment initiation failed' },
      { status: 500 }
    );
  }
}