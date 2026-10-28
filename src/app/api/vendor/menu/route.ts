import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rawCookie = request.cookies.get('staff_session')?.value;
    if (!rawCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
    }

    let session: any = null;
    try {
      let decoded = rawCookie;
      while (decoded.includes('%')) decoded = decodeURIComponent(decoded);
      session = JSON.parse(decoded);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid session token.' }, { status: 401 });
    }

    if (!['vendor_owner', 'super_admin', 'admin'].includes(session.role)) {
      return NextResponse.json({ success: false, message: 'Forbidden.' }, { status: 403 });
    }

    const vendorRes: any = await db.execute(sql`
      SELECT id::text AS id FROM vendors WHERE owner_id = ${session.id}::uuid OR name ILIKE '%Kiwaatule%' LIMIT 1
    `);
    const vendor = Array.isArray(vendorRes) ? vendorRes[0] : vendorRes?.rows?.[0];

    const dishesRes: any = await db.execute(sql`
      SELECT 
        id::text AS id,
        name,
        description,
        category,
        price,
        is_available AS "isAvailable",
        created_at AS "createdAt"
      FROM menu_items
      WHERE vendor_id = ${vendor?.id}::uuid OR vendor_id IS NULL
      ORDER BY category ASC, name ASC
    `);

    const products = Array.isArray(dishesRes) ? dishesRes : (dishesRes?.rows || []);

    return NextResponse.json({
      success: true,
      products
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to load menu.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const rawCookie = request.cookies.get('staff_session')?.value;
    if (!rawCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
    }

    let session: any = null;
    try {
      let decoded = rawCookie;
      while (decoded.includes('%')) decoded = decodeURIComponent(decoded);
      session = JSON.parse(decoded);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid session.' }, { status: 401 });
    }

    const { productId, isAvailable, price } = await request.json();
    if (!productId) {
      return NextResponse.json({ success: false, message: 'Dish identifier (productId) is required.' }, { status: 400 });
    }

    const updatedRes: any = await db.execute(sql`
      UPDATE menu_items
      SET 
        is_available = COALESCE(${isAvailable !== undefined ? isAvailable : null}, is_available),
        price = COALESCE(${price !== undefined ? price : null}, price),
        updated_at = NOW()
      WHERE id = ${productId}::uuid
      RETURNING id::text AS id, name, price, is_available AS "isAvailable"
    `);

    const product = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes?.rows?.[0];
    if (!product) {
      return NextResponse.json({ success: false, message: 'Menu item not found.' }, { status: 404 });
    }

    await logPlatformAudit({
      request,
      action: 'VENDOR_MENU_ITEM_UPDATED',
      targetEntity: 'menu_items',
      targetId: productId,
      actorId: session.id,
      actorRole: session.role,
      metadata: { productId, isAvailable, price }
    });

    return NextResponse.json({
      success: true,
      message: `${product.name} stock status updated.`,
      product
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to update menu dish.' }, { status: 500 });
  }
}
