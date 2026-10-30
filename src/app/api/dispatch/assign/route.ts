import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { orders, users, wallets, walletLedger } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';

export const dynamic = 'force-dynamic';

const MAX_COD_DEBT_LIMIT = -50000; // Strict UGX 50,000 COD debt ceiling
const REMITTANCE_GRACE_PERIOD_HOURS = 72; // 72 Hours Remittance Window

export async function POST(request: NextRequest) {
  try {
    const rawCookie = request.cookies.get('staff_session')?.value;
    let actorId = 'system';
    let actorRole = 'super_admin';

    if (rawCookie) {
      try {
        let dec = rawCookie;
        while (dec.includes('%')) dec = decodeURIComponent(dec);
        const parsed = JSON.parse(dec);
        actorId = parsed?.id || actorId;
        actorRole = parsed?.role || actorRole;
      } catch {}
    }

    const { orderId, riderId } = await request.json();

    if (!orderId || !riderId) {
      return NextResponse.json(
        { success: false, message: 'Both orderId and riderId are required.' },
        { status: 400 }
      );
    }

    // 1. Fetch courier user & wallet
    const [riderUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, riderId))
      .limit(1);

    if (!riderUser || riderUser.role !== 'rider') {
      return NextResponse.json({ success: false, message: 'Courier not found or invalid role.' }, { status: 404 });
    }

    if (!riderUser.isActive) {
      return NextResponse.json(
        { success: false, message: 'Dispatch blocked: Courier account is inactive or locked.' },
        { status: 403 }
      );
    }

    let [riderWallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, riderId))
      .limit(1);

    if (!riderWallet) {
      const [created] = await db
        .insert(wallets)
        .values({ userId: riderId, balance: 0, heldFloat: 0 })
        .returning();
      riderWallet = created;
    }

    // 2. Fetch order details
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found.' }, { status: 404 });
    }

    if (order.riderId && order.riderId !== riderId) {
      return NextResponse.json(
        { success: false, message: 'Order is already assigned to another courier.' },
        { status: 409 }
      );
    }

    const currentBalance = riderWallet.balance || 0;

    // 3. ENFORCE 72-HOUR REMITTANCE RULE
    // If the courier has negative balance (holding cash), check when the debt started
    if (currentBalance < 0) {
      // Find the last time the wallet was fully cleared or last deposit
      const [oldestUnsettledCod] = await db
        .select()
        .from(walletLedger)
        .where(
          and(
            eq(walletLedger.walletId, riderWallet.id),
            eq(walletLedger.entryType, 'cod_cash_collected')
          )
        )
        .orderBy(desc(walletLedger.createdAt))
        .limit(1);

      if (oldestUnsettledCod && oldestUnsettledCod.createdAt) {
        const hoursElapsed = (Date.now() - new Date(oldestUnsettledCod.createdAt).getTime()) / (1000 * 60 * 60);

        if (hoursElapsed > REMITTANCE_GRACE_PERIOD_HOURS) {
          return NextResponse.json(
            {
              success: false,
              message: `Dispatch blocked: Courier has outstanding COD cash unremitted for ${Math.floor(hoursElapsed)} hours (exceeds 72-hour limit). Courier must remit cash via MoMo immediately.`,
              hoursElapsed: Math.floor(hoursElapsed),
              limitHours: REMITTANCE_GRACE_PERIOD_HOURS,
              currentBalance,
            },
            { status: 422 }
          );
        }
      }
    }

    // 4. ENFORCE UGX 50,000 COD DEBT CEILING
    if (order.paymentMethod === 'cod') {
      const codDue = order.codAmountDue || order.totalAmount || 0;
      const netCashLiability = codDue - (order.deliveryFee || 0);
      const projectedBalance = currentBalance - netCashLiability;

      if (projectedBalance < MAX_COD_DEBT_LIMIT) {
        return NextResponse.json(
          {
            success: false,
            message: `Dispatch blocked: Courier COD debt limit reached. Current balance is UGX ${currentBalance.toLocaleString()}, this order adds UGX ${netCashLiability.toLocaleString()} in liability, reaching UGX ${projectedBalance.toLocaleString()} (limit: UGX -50,000). Courier must remit cash via MoMo before accepting new COD runs.`,
            currentBalance,
            projectedBalance,
            limit: MAX_COD_DEBT_LIMIT,
          },
          { status: 422 }
        );
      }
    }

    // 5. Assign Courier
    await db.transaction(async (tx) => {
      await tx
        .update(orders)
        .set({
          riderId: riderUser.id,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      await logPlatformAudit({
        request,
        action: 'ORDER_ASSIGNED_TO_RIDER',
        targetEntity: 'orders',
        targetId: order.id,
        actorId,
        actorRole,
        metadata: {
          orderNumber: order.orderNumber,
          riderId: riderUser.id,
          riderPhone: riderUser.phone,
          riderBalance: currentBalance,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Order #${order.orderNumber} successfully assigned to courier.`,
      orderId: order.id,
      riderId: riderUser.id,
      currentBalance,
    });
  } catch (error: any) {
    console.error('Dispatch assign error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
