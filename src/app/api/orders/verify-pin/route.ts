import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, wallets, walletLedger, vendors } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const PLATFORM_ADMIN_USER_ID = '10000000-0000-0000-0000-000000000003';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderId = body?.orderId;
    const pin = body?.pin;
    const cashCollected = body?.cashCollected;

    if (!orderId || !pin) {
      return NextResponse.json(
        { success: false, message: 'Order ID and Handshake PIN are required.' },
        { status: 400 }
      );
    }

    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
    }

    if (order.status === 'delivered') {
      return NextResponse.json(
        { success: false, message: 'Order is already delivered and settled.' },
        { status: 400 }
      );
    }

    if (String(order.deliveryPin).trim() !== String(pin).trim()) {
      return NextResponse.json(
        { success: false, message: 'Invalid Handshake PIN. Do not release package.' },
        { status: 401 }
      );
    }

    const cashReceived = cashCollected !== undefined && cashCollected !== null
      ? Math.round(Number(cashCollected))
      : (order.codAmountDue || order.totalAmount || 0);

    await db.transaction(async (tx) => {
      // 1. Mark Order Delivered
      await tx.update(orders).set({
        status: 'delivered',
        codCashReceived: cashReceived,
        codVerifiedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(orders.id, orderId));

      // 2. Courier Settlement
      if (order.riderId) {
        let [riderWallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.userId, order.riderId))
          .limit(1);

        if (!riderWallet) {
          const [created] = await tx
            .insert(wallets)
            .values({ userId: order.riderId, balance: 0, heldFloat: 0 })
            .returning();
          riderWallet = created;
        }

        const deliveryFee = order.deliveryFee || 0;

        if (order.paymentMethod === 'cod') {
          const netDebit = cashReceived - deliveryFee;
          const updatedRiderBalance = (riderWallet.balance || 0) - netDebit;

          await tx
            .update(wallets)
            .set({ balance: updatedRiderBalance })
            .where(eq(wallets.id, riderWallet.id));

          await tx.insert(walletLedger).values({
            walletId: riderWallet.id,
            orderId: order.id,
            entryType: 'cod_cash_collected',
            amount: -cashReceived,
            balanceAfter: (riderWallet.balance || 0) - cashReceived,
            metadata: {
              orderNumber: order.orderNumber,
              notes: `Physical COD collected by courier for order #${order.orderNumber}`
            },
          });

          await tx.insert(walletLedger).values({
            walletId: riderWallet.id,
            orderId: order.id,
            entryType: 'rider_delivery_payout',
            amount: deliveryFee,
            balanceAfter: updatedRiderBalance,
            metadata: {
              orderNumber: order.orderNumber,
              notes: `Delivery payout credit for order #${order.orderNumber}`
            },
          });
        } else {
          const updatedRiderBalance = (riderWallet.balance || 0) + deliveryFee;

          await tx
            .update(wallets)
            .set({ balance: updatedRiderBalance })
            .where(eq(wallets.id, riderWallet.id));

          await tx.insert(walletLedger).values({
            walletId: riderWallet.id,
            orderId: order.id,
            entryType: 'rider_delivery_payout',
            amount: deliveryFee,
            balanceAfter: updatedRiderBalance,
            metadata: {
              orderNumber: order.orderNumber,
              notes: `Escrow release: Delivery fee payout for order #${order.orderNumber}`
            },
          });
        }
      }

      // 3. Merchant & Marketplace Commission Settlement
      const commissionBps = 1000; // 10% standard marketplace take
      const commissionFraction = commissionBps / 10000.0;
      const productSubtotal = order.productSubtotal || 0;
      const retainedCommission = Math.round(productSubtotal * commissionFraction);
      const netMerchantPayable = productSubtotal - retainedCommission;

      if (order.vendorId) {
        const [vendorRecord] = await tx
          .select()
          .from(vendors)
          .where(eq(vendors.id, order.vendorId))
          .limit(1);

        if (vendorRecord && vendorRecord.ownerId) {
          let [vendorWallet] = await tx
            .select()
            .from(wallets)
            .where(eq(wallets.userId, vendorRecord.ownerId))
            .limit(1);

          if (!vendorWallet) {
            const [created] = await tx
              .insert(wallets)
              .values({ userId: vendorRecord.ownerId, balance: 0, heldFloat: 0 })
              .returning();
            vendorWallet = created;
          }

          const updatedVendorBalance = (vendorWallet.balance || 0) + netMerchantPayable;
          await tx
            .update(wallets)
            .set({ balance: updatedVendorBalance })
            .where(eq(wallets.id, vendorWallet.id));

          await tx.insert(walletLedger).values({
            walletId: vendorWallet.id,
            orderId: order.id,
            entryType: 'platform_delivery_share',
            amount: netMerchantPayable,
            balanceAfter: updatedVendorBalance,
            metadata: {
              orderNumber: order.orderNumber,
              notes: `Merchant payable (subtotal UGX ${productSubtotal} less 10% platform commission)`,
              commissionDeducted: retainedCommission,
            },
          });
        }
      }

      // 4. Platform Master Treasury Settlement
      let [platformWallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, PLATFORM_ADMIN_USER_ID))
        .limit(1);

      if (!platformWallet) {
        const [created] = await tx
          .insert(wallets)
          .values({ userId: PLATFORM_ADMIN_USER_ID, balance: 0, heldFloat: 0 })
          .returning();
        platformWallet = created;
      }

      const serviceFee = order.serviceFee || 0;
      const convenienceFee = order.convenienceFee || 0;
      const damageProtectionFee = order.damageProtectionFee || 0;
      const totalPlatformCommission = retainedCommission + serviceFee + convenienceFee;

      let runningPlatformBal = platformWallet.balance || 0;

      if (totalPlatformCommission > 0) {
        runningPlatformBal += totalPlatformCommission;
        await tx.insert(walletLedger).values({
          walletId: platformWallet.id,
          orderId: order.id,
          entryType: 'platform_commission',
          amount: totalPlatformCommission,
          balanceAfter: runningPlatformBal,
          metadata: {
            orderNumber: order.orderNumber,
            serviceFee,
            convenienceFee,
            merchantCommission: retainedCommission,
            notes: `Platform fee realization for order #${order.orderNumber}`,
          },
        });
      }

      if (damageProtectionFee > 0) {
        runningPlatformBal += damageProtectionFee;
        await tx.insert(walletLedger).values({
          walletId: platformWallet.id,
          orderId: order.id,
          entryType: 'damage_reserve_credit',
          amount: damageProtectionFee,
          balanceAfter: runningPlatformBal,
          metadata: {
            orderNumber: order.orderNumber,
            notes: `Damage reserve ring-fenced escrow for order #${order.orderNumber}`,
          },
        });
      }

      await tx
        .update(wallets)
        .set({ balance: runningPlatformBal })
        .where(eq(wallets.id, platformWallet.id));
    });

    return NextResponse.json({
      success: true,
      message: 'Escrow released and atomic settlement successfully balanced.',
      orderNumber: order.orderNumber,
      status: 'delivered',
    });
  } catch (err: any) {
    console.error('Handshake Settlement Error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
