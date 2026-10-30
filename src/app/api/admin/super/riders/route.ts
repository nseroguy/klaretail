import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { users, wallets, walletLedger, orders } from '@/db/schema';
import { eq, sql, desc, and } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';
import { normalizeUgandanPhone } from '@/utils/phoneUtils';

export const dynamic = 'force-dynamic';

const MAX_COD_DEBT_LIMIT = -50000;
const REMITTANCE_GRACE_PERIOD_HOURS = 72;

export async function GET(request: NextRequest) {
  try {
    // 1. Fetch all couriers from unified users + wallets
    const couriers = await db
      .select({
        id: users.id,
        phone: users.phone,
        isActive: users.isActive,
        createdAt: users.createdAt,
        walletId: wallets.id,
        balance: wallets.balance,
      })
      .from(users)
      .leftJoin(wallets, eq(users.id, wallets.userId))
      .where(eq(users.role, 'rider'))
      .orderBy(desc(users.createdAt));

    const now = Date.now();

    const enriched = await Promise.all(
      couriers.map(async (c) => {
        const balance = c.balance || 0;
        const currentDebt = balance < 0 ? Math.abs(balance) : 0;

        // 2. Compute active & completed orders
        const [activeCountRes] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(orders)
          .where(and(eq(orders.riderId, c.id), sql`${orders.status} IN ('accepted', 'dispatched')`));

        const [completedCountRes] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(orders)
          .where(and(eq(orders.riderId, c.id), eq(orders.status, 'delivered')));

        // 3. Compute 72h aging liability
        let hoursSinceOldestUnremitted = 0;
        let isOverdue72h = false;

        if (balance < 0 && c.walletId) {
          const [oldestCollection] = await db
            .select()
            .from(walletLedger)
            .where(
              and(
                eq(walletLedger.walletId, c.walletId),
                eq(walletLedger.entryType, 'cod_cash_collected')
              )
            )
            .orderBy(desc(walletLedger.createdAt))
            .limit(1);

          if (oldestCollection && oldestCollection.createdAt) {
            hoursSinceOldestUnremitted = Math.floor(
              (now - new Date(oldestCollection.createdAt).getTime()) / (1000 * 60 * 60)
            );
            if (hoursSinceOldestUnremitted >= REMITTANCE_GRACE_PERIOD_HOURS) {
              isOverdue72h = true;
            }
          }
        }

        const isCeilingBreached = balance <= MAX_COD_DEBT_LIMIT;
        const isLocked = !c.isActive || isCeilingBreached || isOverdue72h;

        return {
          id: c.id,
          name: c.phone, // Default display identifier
          phone: c.phone,
          isActive: c.isActive,
          walletId: c.walletId,
          walletBalance: balance,
          currentCashAtRisk: currentDebt,
          maxCashLimit: Math.abs(MAX_COD_DEBT_LIMIT),
          hoursSinceOldestUnremitted,
          isOverdue72h,
          isCeilingBreached,
          isLocked,
          activeDeliveries: activeCountRes?.count || 0,
          completedDeliveries: completedCountRes?.count || 0,
          utilizationPct: Math.min(100, Math.round((currentDebt / Math.abs(MAX_COD_DEBT_LIMIT)) * 100)),
        };
      })
    );

    return NextResponse.json({ success: true, riders: enriched });
  } catch (error: any) {
    console.error('Failed to query super riders:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

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

    const body = await request.json();
    const { action, riderId, amount, reason } = body;

    if (!riderId) {
      return NextResponse.json({ success: false, message: 'riderId is required.' }, { status: 400 });
    }

    // 1. Action: Manual Wallet Adjustment / Debt Write-off / Float Credit
    if (action === 'adjust_wallet') {
      const adjustAmount = Number(amount);
      if (!adjustAmount || isNaN(adjustAmount)) {
        return NextResponse.json({ success: false, message: 'A valid numeric amount is required.' }, { status: 400 });
      }

      if (!reason || reason.trim().length < 5) {
        return NextResponse.json(
          { success: false, message: 'An explicit audit reason of at least 5 characters is required.' },
          { status: 400 }
        );
      }

      let [wallet] = await db.select().from(wallets).where(eq(wallets.userId, riderId)).limit(1);
      if (!wallet) {
        const [created] = await db.insert(wallets).values({ userId: riderId, balance: 0, heldFloat: 0 }).returning();
        wallet = created;
      }

      const currentBalance = wallet.balance || 0;
      const newBalance = currentBalance + adjustAmount;

      await db.transaction(async (tx) => {
        await tx.update(wallets).set({ balance: newBalance }).where(eq(wallets.id, wallet.id));

        await tx.insert(walletLedger).values({
          walletId: wallet.id,
          entryType: 'staff_manual_adjustment',
          amount: adjustAmount,
          balanceAfter: newBalance,
          metadata: {
            actorId,
            actorRole,
            reason,
            notes: `Super Admin adjustment of UGX ${adjustAmount.toLocaleString()} (${reason})`,
          },
        });

        await logPlatformAudit({
          request,
          action: 'STAFF_WALLET_ADJUSTMENT',
          targetEntity: 'wallets',
          targetId: wallet.id,
          actorId,
          actorRole,
          metadata: {
            riderId,
            adjustAmount,
            previousBalance: currentBalance,
            newBalance,
            reason,
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: `Wallet adjusted successfully. New balance: UGX ${newBalance.toLocaleString()}`,
        previousBalance: currentBalance,
        newBalance,
      });
    }

    // 2. Action: Emergency Lock / Unlock Courier
    if (action === 'toggle_lock') {
      const [user] = await db.select().from(users).where(eq(users.id, riderId)).limit(1);
      if (!user) {
        return NextResponse.json({ success: false, message: 'Courier user not found.' }, { status: 404 });
      }

      const nextStatus = !user.isActive;

      await db.update(users).set({ isActive: nextStatus, updatedAt: new Date() }).where(eq(users.id, riderId));

      await logPlatformAudit({
        request,
        action: nextStatus ? 'COURIER_UNLOCKED' : 'COURIER_LOCKED',
        targetEntity: 'users',
        targetId: riderId,
        actorId,
        actorRole,
        metadata: {
          courierPhone: user.phone,
          previousStatus: user.isActive,
          nextStatus,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Courier ${user.phone} is now ${nextStatus ? 'ACTIVE' : 'LOCKED'}.`,
        isActive: nextStatus,
      });
    }

    // 3. Action: Onboard New Courier
    if (action === 'create_rider') {
      const { phone: rawPhone } = body;
      const phone = normalizeUgandanPhone(rawPhone);
      if (!phone) {
        return NextResponse.json({ success: false, message: 'Invalid Ugandan phone number format.' }, { status: 422 });
      }

      let [existing] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
      if (existing) {
        await db.update(users).set({ role: 'rider', isActive: true }).where(eq(users.id, existing.id));
      } else {
        const [created] = await db.insert(users).values({ phone, role: 'rider', isActive: true }).returning();
        existing = created;
      }

      let [wallet] = await db.select().from(wallets).where(eq(wallets.userId, existing.id)).limit(1);
      if (!wallet) {
        await db.insert(wallets).values({ userId: existing.id, balance: 0, heldFloat: 0 });
      }

      return NextResponse.json({ success: true, message: `Courier ${phone} onboarded successfully.`, riderId: existing.id });
    }

    return NextResponse.json({ success: false, message: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Super riders POST error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
