import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const rawCookie = 
      req.cookies.get('session_token')?.value || 
      req.cookies.get('staff_session')?.value || 
      req.cookies.get('klaretail_session')?.value ||
      req.cookies.get('vendor_session')?.value;

    if (!rawCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Session missing.' }, { status: 401 });
    }

    let session: any;
    try {
      let dec = rawCookie;
      while (dec.includes('%')) dec = decodeURIComponent(dec);
      session = JSON.parse(dec);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid session format' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const querySlug = searchParams.get('slug');
    const queryVendorId = searchParams.get('vendorId');

    const targetSlug = querySlug || session.vendorSlug || null;
    const targetVendorId = queryVendorId || session.vendorId || null;
    const targetUserId = session.id || session.userId || null;

    let vendorRes: any = null;

    if (targetSlug) {
      vendorRes = await db.execute(sql`
        SELECT id, name, slug, owner_id FROM vendors WHERE slug = ${targetSlug} LIMIT 1;
      `);
    }

    if ((!vendorRes || (!Array.isArray(vendorRes) && !vendorRes?.rows?.length)) && targetVendorId) {
      vendorRes = await db.execute(sql`
        SELECT id, name, slug, owner_id FROM vendors WHERE id = ${targetVendorId}::uuid LIMIT 1;
      `);
    }

    if (!vendorRes || (!Array.isArray(vendorRes) && !vendorRes?.rows?.length)) {
      vendorRes = await db.execute(sql`
        SELECT id, name, slug, owner_id FROM vendors WHERE owner_id = ${targetUserId}::uuid LIMIT 1;
      `);
    }

    const vendor = Array.isArray(vendorRes) ? vendorRes[0] : vendorRes?.rows?.[0];

    if (!vendor) {
      return NextResponse.json({ success: true, vendor: null, products: [], items: [], menu: [], message: 'Vendor not found' });
    }

    const itemsRes: any = await db.execute(sql`
      SELECT 
        id::text AS id,
        name,
        price,
        description,
        is_available AS "isAvailable",
        created_at AS "createdAt"
      FROM menu_items
      WHERE vendor_id = ${vendor.id}::uuid
      ORDER BY name ASC;
    `);

    const items = Array.isArray(itemsRes) ? itemsRes : itemsRes?.rows || [];

    return NextResponse.json({
      success: true,
      vendor: { id: vendor.id, name: vendor.name, slug: vendor.slug },
      products: items, // required by fetchMenu in orders/page.tsx
      items,
      menu: items,
    });
  } catch (error: any) {
    console.error('[/api/vendor/menu GET] Error:', error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const rawCookie = 
      req.cookies.get('session_token')?.value || 
      req.cookies.get('staff_session')?.value || 
      req.cookies.get('klaretail_session')?.value ||
      req.cookies.get('vendor_session')?.value;

    if (!rawCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Session missing.' }, { status: 401 });
    }

    const body = await req.json();
    const id = body.productId || body.itemId;
    const isAvailable = Boolean(body.isAvailable);

    if (!id) {
      return NextResponse.json({ success: false, message: 'Missing productId parameter.' }, { status: 400 });
    }

    const updatedRes: any = await db.execute(sql`
      UPDATE menu_items
      SET is_available = ${isAvailable}
      WHERE id = ${id}::uuid
      RETURNING id, name, is_available AS "isAvailable", vendor_id AS "vendorId";
    `);

    const updated = Array.isArray(updatedRes) ? updatedRes[0] : updatedRes?.rows?.[0];

    if (!updated) {
      return NextResponse.json({ success: false, message: 'Item not found in database.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Item "${updated.name}" is now ${updated.isAvailable ? 'available' : 'marked as 86 (unavailable)'}.`,
      item: updated,
    });
  } catch (error: any) {
    console.error('[/api/vendor/menu PATCH] Error:', error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
