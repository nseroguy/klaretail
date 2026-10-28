import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';
import { normalizeUgandanPhone } from '@/utils/phoneUtils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const vendorsResult: any = await db.execute(sql`
      SELECT 
        v.id::text AS id,
        v.name,
        v.slug,
        v.owner_id::text AS "ownerId",
        v.latitude::text AS latitude,
        v.longitude::text AS longitude,
        v.default_slot_capacity AS "defaultSlotCapacity",
        v.is_accepting_orders AS "isAcceptingOrders",
        COALESCE(v.commission_bps, 1000)::int AS commission_bps,
        COALESCE(v.is_verified, true)::boolean AS is_verified,
        COALESCE(v.payout_status, 'active')::text AS payout_status,
        v.created_at,
        u.phone AS "ownerPhone",
        (SELECT COUNT(*)::int FROM orders o WHERE o.vendor_id = v.id) AS total_orders,
        (SELECT COALESCE(SUM(o.total_amount), 0)::numeric FROM orders o WHERE o.vendor_id = v.id AND o.status::text = 'delivered') AS gross_sales
      FROM vendors v
      LEFT JOIN users u ON v.owner_id = u.id
      ORDER BY v.created_at DESC
    `);

    const vendors = Array.isArray(vendorsResult) ? vendorsResult : (vendorsResult?.rows || []);

    return NextResponse.json({
      success: true,
      vendors: vendors.map((v: any) => ({
        id: v.id,
        name: v.name,
        slug: v.slug,
        ownerId: v.ownerId,
        ownerPhone: v.ownerPhone || 'Unlinked',
        latitude: Number(v.latitude || 0.3476),
        longitude: Number(v.longitude || 32.5825),
        defaultSlotCapacity: Number(v.defaultSlotCapacity || 5),
        isAcceptingOrders: Boolean(v.isAcceptingOrders),
        commissionBps: Number(v.commission_bps || 1000),
        isVerified: Boolean(v.is_verified),
        payoutStatus: v.payout_status || 'active',
        totalOrders: Number(v.total_orders || 0),
        grossSales: Number(v.gross_sales || 0),
        createdAt: v.created_at,
      }))
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch vendors' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug, ownerPhone: rawPhone, latitude, longitude, commissionBps, defaultSlotCapacity } = body;
    const ownerPhone = normalizeUgandanPhone(rawPhone) || rawPhone.trim();

    if (!name || !ownerPhone) {
      return NextResponse.json(
        { success: false, message: 'Vendor name and owner phone number are required.' },
        { status: 400 }
      );
    }

    const cleanSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    const lat = latitude ? parseFloat(latitude) : 0.347596;
    const lng = longitude ? parseFloat(longitude) : 32.582520;
    const bps = commissionBps ? parseInt(commissionBps, 10) : 1000;
    const capacity = defaultSlotCapacity ? parseInt(defaultSlotCapacity, 10) : 5;

    // 1. Ensure or create user with phone and assign vendor_owner role
    let ownerId: string;
    const userCheck: any = await db.execute(sql`
      SELECT id, role::text AS role FROM users WHERE phone = ${ownerPhone.trim()} LIMIT 1
    `);
    const existingUser = Array.isArray(userCheck) ? userCheck[0] : userCheck?.rows?.[0];

    if (existingUser) {
      ownerId = existingUser.id;
      if (existingUser.role !== 'vendor_owner' && existingUser.role !== 'admin' && existingUser.role !== 'super_admin') {
        await db.execute(sql`
          UPDATE users SET role = 'vendor_owner'::user_role WHERE id = ${ownerId}::uuid
        `);
      }
    } else {
      const newUserResult: any = await db.execute(sql`
        INSERT INTO users (phone, role, is_active)
        VALUES (${ownerPhone.trim()}, 'vendor_owner'::user_role, true)
        RETURNING id
      `);
      const created = Array.isArray(newUserResult) ? newUserResult[0] : newUserResult?.rows?.[0];
      ownerId = created.id;
    }

    // 2. Insert vendor record
    const insertResult: any = await db.execute(sql`
      INSERT INTO vendors (
        name,
        slug,
        owner_id,
        latitude,
        longitude,
        default_slot_capacity,
        is_accepting_orders,
        commission_bps,
        is_verified,
        payout_status
      ) VALUES (
        ${name.trim()},
        ${cleanSlug},
        ${ownerId}::uuid,
        ${lat},
        ${lng},
        ${capacity},
        true,
        ${bps},
        true,
        'active'
      )
      RETURNING id, name, slug
    `);

    const createdVendor = Array.isArray(insertResult) ? insertResult[0] : insertResult?.rows?.[0];

    // 3. Write immutable audit log
    await logPlatformAudit({
      request,
      action: 'VENDOR_CREATED',
      targetEntity: 'vendors',
      targetId: createdVendor?.id,
      metadata: {
        vendorName: createdVendor?.name,
        slug: createdVendor?.slug,
        ownerPhone: ownerPhone.trim(),
        commissionBps: bps,
        slotCapacity: capacity
      }
    });

    return NextResponse.json({
      success: true,
      message: `Store ${createdVendor?.name} successfully created.`,
      vendor: createdVendor
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Vendor creation failed' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { vendorId, action, value } = body;

    if (!vendorId || !action) {
      return NextResponse.json(
        { success: false, message: 'vendorId and action are required' },
        { status: 400 }
      );
    }

    if (action === 'set_commission') {
      const bps = parseInt(value, 10);
      if (isNaN(bps) || bps < 0 || bps > 10000) {
        return NextResponse.json(
          { success: false, message: 'Invalid basis points (0-10000)' },
          { status: 400 }
        );
      }

      await db.execute(sql`
        UPDATE vendors 
        SET commission_bps = ${bps} 
        WHERE id = ${vendorId}::uuid
      `);

      await logPlatformAudit({
        request,
        action: 'VENDOR_COMMISSION_OVERRIDE',
        targetEntity: 'vendors',
        targetId: vendorId,
        metadata: { newCommissionBps: bps, newPercentage: `${(bps / 100).toFixed(2)}%` }
      });

      return NextResponse.json({
        success: true,
        message: `Commission updated to ${(bps / 100).toFixed(2)}% (${bps} bps)`
      });
    }

    if (action === 'toggle_verification') {
      const updateResult: any = await db.execute(sql`
        UPDATE vendors 
        SET is_verified = NOT COALESCE(is_verified, true) 
        WHERE id = ${vendorId}::uuid
        RETURNING is_verified, name
      `);
      const updated = Array.isArray(updateResult) ? updateResult[0] : updateResult?.rows?.[0];

      await logPlatformAudit({
        request,
        action: 'VENDOR_VERIFICATION_TOGGLE',
        targetEntity: 'vendors',
        targetId: vendorId,
        metadata: { vendorName: updated?.name, isVerified: Boolean(updated?.is_verified) }
      });

      return NextResponse.json({ success: true, message: 'Verification status updated.' });
    }

    if (action === 'toggle_orders') {
      const updateResult: any = await db.execute(sql`
        UPDATE vendors 
        SET is_accepting_orders = NOT COALESCE(is_accepting_orders, true) 
        WHERE id = ${vendorId}::uuid
        RETURNING is_accepting_orders, name
      `);
      const updated = Array.isArray(updateResult) ? updateResult[0] : updateResult?.rows?.[0];

      await logPlatformAudit({
        request,
        action: 'VENDOR_ORDER_ACCEPTANCE_TOGGLED',
        targetEntity: 'vendors',
        targetId: vendorId,
        metadata: { vendorName: updated?.name, isAcceptingOrders: Boolean(updated?.is_accepting_orders) }
      });

      return NextResponse.json({ success: true, message: 'Order intake status updated.' });
    }

    if (action === 'set_payout_status') {
      const allowed = ['active', 'frozen', 'under_review'];
      if (!allowed.includes(value)) {
        return NextResponse.json(
          { success: false, message: 'Invalid payout status' },
          { status: 400 }
        );
      }

      await db.execute(sql`
        UPDATE vendors 
        SET payout_status = ${value} 
        WHERE id = ${vendorId}::uuid
      `);

      await logPlatformAudit({
        request,
        action: 'VENDOR_PAYOUT_STATUS_CHANGE',
        targetEntity: 'vendors',
        targetId: vendorId,
        metadata: { payoutStatus: value }
      });

      return NextResponse.json({ success: true, message: `Payout status set to ${value}.` });
    }

    return NextResponse.json(
      { success: false, message: 'Unknown action' },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Mutation failed' },
      { status: 500 }
    );
  }
}
