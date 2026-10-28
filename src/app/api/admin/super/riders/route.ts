import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';
import { normalizeUgandanPhone } from '@/utils/phoneUtils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const ridersResult: any = await db.execute(sql`
      SELECT 
        r.id::text AS id,
        r.name,
        r.phone,
        r.vehicle_plate AS "vehiclePlate",
        r.is_active AS "isActive",
        r.is_available AS "isAvailable",
        COALESCE(r.is_locked, false) AS "isLocked",
        COALESCE(r.max_cash_limit, 50000.00)::numeric AS "maxCashLimit",
        COALESCE(r.wallet_balance, 0.00)::numeric AS "walletBalance",
        COALESCE(
          (SELECT SUM(o.total_amount) 
           FROM orders o 
           WHERE o.assigned_rider_id = r.id 
             AND o.status::text IN ('rider_assigned', 'dispatched') 
             AND o.payment_method::text IN ('cod', 'CASH_ON_DELIVERY')), 
          0
        )::numeric AS "currentCashAtRisk",
        COALESCE(
          (SELECT SUM(COALESCE(o.cod_cash_received, o.total_amount)) 
           FROM orders o 
           WHERE o.assigned_rider_id = r.id 
             AND o.status::text = 'delivered' 
             AND o.payment_method::text IN ('cod', 'CASH_ON_DELIVERY')), 
          0
        )::numeric AS "totalCashSettled",
        COALESCE(
          (SELECT COUNT(*) FROM orders o WHERE o.assigned_rider_id = r.id AND o.status::text = 'delivered'),
          0
        )::int AS "completedDeliveries",
        COALESCE(
          (SELECT COUNT(*) FROM orders o WHERE o.assigned_rider_id = r.id AND o.status::text IN ('rider_assigned', 'dispatched')),
          0
        )::int AS "activeDeliveries"
      FROM riders r
      ORDER BY r.name ASC
    `);

    const riders = Array.isArray(ridersResult) ? ridersResult : (ridersResult?.rows || []);

    const enriched = riders.map((r: any) => {
      const atRisk = Number(r.walletBalance || r.currentCashAtRisk || 0);
      const limit = Number(r.maxCashLimit || 50000);
      const utilPct = limit > 0 ? Math.min(100, Math.round((atRisk / limit) * 100)) : 0;

      return {
        ...r,
        currentCashAtRisk: atRisk,
        totalCashSettled: Number(r.totalCashSettled || 0),
        maxCashLimit: limit,
        utilizationPct: utilPct,
        isLocked: Boolean(r.isLocked || atRisk >= limit)
      };
    });

    return NextResponse.json({ success: true, riders: enriched });
  } catch (error: any) {
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
        const parsed = JSON.parse(decodeURIComponent(rawCookie));
        actorId = parsed?.id || actorId;
        actorRole = parsed?.role || actorRole;
      } catch {}
    }

    const body = await request.json();
    const { action, riderId, name, phone: rawPhone, vehiclePlate, maxCashLimit } = body;

    // 1. Action: Onboard New Courier
    if (action === 'create_rider') {
      if (!name || !rawPhone || !vehiclePlate) {
        return NextResponse.json({ success: false, message: 'Name, phone, and vehicle plate are required.' }, { status: 400 });
      }

      const phone = normalizeUgandanPhone(rawPhone);
      if (!phone) {
        return NextResponse.json({ success: false, message: 'Invalid Ugandan phone number format.' }, { status: 422 });
      }

      // Check if user credentials already exist or create user
      const existingUserResult: any = await db.execute(sql`SELECT id::text AS id FROM users WHERE phone = ${phone} LIMIT 1`);
      const existingUser = Array.isArray(existingUserResult) ? existingUserResult[0] : existingUserResult?.rows?.[0];
      let userId = existingUser?.id;

      if (!userId) {
        const newUserResult: any = await db.execute(sql`
          INSERT INTO users (phone, role, is_active, created_at, updated_at)
          VALUES (${phone}, 'rider', true, NOW(), NOW())
          RETURNING id::text AS id
        `);
        const newUser = Array.isArray(newUserResult) ? newUserResult[0] : newUserResult?.rows?.[0];
        userId = newUser?.id;
      }

      // Check if already in riders table
      const existingRiderResult: any = await db.execute(sql`SELECT id::text AS id FROM riders WHERE phone = ${phone} LIMIT 1`);
      const existingRider = Array.isArray(existingRiderResult) ? existingRiderResult[0] : existingRiderResult?.rows?.[0];

      if (existingRider) {
        return NextResponse.json({ success: false, message: 'A courier with this phone number is already registered.' }, { status: 409 });
      }

      const newRiderResult: any = await db.execute(sql`
        INSERT INTO riders (
          id, name, phone, vehicle_plate, is_active, is_available, current_latitude, current_longitude, is_locked, max_cash_limit, wallet_balance, created_at, updated_at
        ) VALUES (
          COALESCE(${userId}::uuid, gen_random_uuid()),
          ${name.trim()},
          ${phone},
          ${vehiclePlate.trim().toUpperCase()},
          true,
          true,
          0.347596,
          32.582520,
          false,
          50000.00,
          0.00,
          NOW(),
          NOW()
        )
        RETURNING id::text AS id, name, phone, vehicle_plate AS "vehiclePlate", max_cash_limit AS "maxCashLimit"
      `);

      const newRider = Array.isArray(newRiderResult) ? newRiderResult[0] : newRiderResult?.rows?.[0];

      await logPlatformAudit({
        request,
        action: 'COURIER_ONBOARDED',
        targetEntity: 'riders',
        targetId: newRider?.id,
        actorId,
        actorRole,
        metadata: { name, phone, vehiclePlate }
      });

      return NextResponse.json({
        success: true,
        message: `Courier ${name} onboarded successfully with UGX 50,000 max cash ceiling.`,
        rider: newRider
      });
    }

    // 2. Rider ID is required for operational actions
    if (!riderId) {
      return NextResponse.json({ success: false, message: 'riderId is required' }, { status: 400 });
    }

    // 3. Action: Clear Cash Remittance (Executive Sign-Off)
    if (action === 'clear_cash') {
      const clearedResult: any = await db.execute(sql`
        UPDATE riders 
        SET wallet_balance = 0.00,
            is_locked = false,
            is_available = true,
            updated_at = NOW()
        WHERE id = ${riderId}::uuid
        RETURNING id::text AS id, name, wallet_balance AS "walletBalance", is_locked AS "isLocked"
      `);

      const cleared = Array.isArray(clearedResult) ? clearedResult[0] : clearedResult?.rows?.[0];

      await logPlatformAudit({
        request,
        action: 'RIDER_CASH_CLEARED_BY_ADMIN',
        targetEntity: 'riders',
        targetId: cleared.id,
        actorId,
        actorRole,
        metadata: { riderName: cleared.name, resetAmount: '0.00' }
      });

      return NextResponse.json({
        success: true,
        message: `Remittance verified. Courier ${cleared.name}'s balance reset to UGX 0. Account unlocked.`,
        rider: cleared
      });
    }

    // 4. Action: Toggle Lock
    if (action === 'toggle_lock') {
      const updatedResult: any = await db.execute(sql`
        UPDATE riders 
        SET is_locked = NOT COALESCE(is_locked, false),
            updated_at = NOW()
        WHERE id = ${riderId}::uuid
        RETURNING id::text, name, is_locked AS "isLocked"
      `);

      const updated = Array.isArray(updatedResult) ? updatedResult[0] : updatedResult?.rows?.[0];
      if (!updated) {
        return NextResponse.json({ success: false, message: 'Rider not found' }, { status: 404 });
      }

      await logPlatformAudit({
        request,
        action: updated.isLocked ? 'RIDER_ACCOUNT_LOCKED' : 'RIDER_ACCOUNT_UNLOCKED',
        targetEntity: 'riders',
        targetId: updated.id,
        actorId,
        actorRole,
        metadata: { riderName: updated.name, isLocked: updated.isLocked }
      });

      return NextResponse.json({
        success: true,
        message: `Courier ${updated.name} is now ${updated.isLocked ? 'LOCKED' : 'ACTIVE'}.`,
        rider: updated
      });
    }

    // 5. Action: Set Cash Limit
    if (action === 'set_limit' && maxCashLimit !== undefined) {
      const updatedResult: any = await db.execute(sql`
        UPDATE riders 
        SET max_cash_limit = ${Number(maxCashLimit)},
            updated_at = NOW()
        WHERE id = ${riderId}::uuid
        RETURNING id::text, name, max_cash_limit AS "maxCashLimit"
      `);

      const updated = Array.isArray(updatedResult) ? updatedResult[0] : updatedResult?.rows?.[0];

      await logPlatformAudit({
        request,
        action: 'RIDER_LIMIT_MODIFIED',
        targetEntity: 'riders',
        targetId: updated.id,
        actorId,
        actorRole,
        metadata: { riderName: updated.name, newLimit: Number(maxCashLimit) }
      });

      return NextResponse.json({
        success: true,
        message: `Updated cash limit for ${updated.name} to UGX ${Number(maxCashLimit).toLocaleString()}`,
        rider: updated
      });
    }

    return NextResponse.json({ success: false, message: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
