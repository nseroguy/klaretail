import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const rawCookie = req.cookies.get('staff_session')?.value || req.cookies.get('session_token')?.value;
    if (!rawCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Session missing.' }, { status: 401 });
    }

    let session: any;
    try {
      let dec = rawCookie;
      while (dec.includes('%')) dec = decodeURIComponent(dec);
      session = JSON.parse(dec);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid session' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const categoryParam = searchParams.get('category');
    const category = categoryParam && categoryParam.trim().length > 0 ? categoryParam.trim() : null;

    const catalog: any = await db.execute(sql`
      SELECT 
        wpt.id AS "tierId",
        wpt.unit_of_measure AS "unitOfMeasure",
        wpt.min_order_quantity AS "minOrderQuantity",
        wpt.tier_price AS "tierPrice",
        wpt.stock_units_available AS "stockAvailable",
        p.id AS "productId",
        p.name AS "productName",
        p.description AS "productDescription",
        p.image_url AS "imageUrl",
        v.id AS "wholesalerId",
        v.name AS "wholesalerName",
        v.slug AS "wholesalerSlug"
      FROM wholesale_product_tiers wpt
      JOIN products p ON wpt.product_id = p.id
      JOIN vendors v ON wpt.wholesaler_vendor_id = v.id
      WHERE v.vendor_type = 'wholesaler'
        AND (${category}::text IS NULL OR p.category ILIKE ${category ? `%${category}%` : null})
      ORDER BY p.name ASC;
    `);

    const items = Array.isArray(catalog) ? catalog : catalog?.rows || [];

    return NextResponse.json({
      success: true,
      totalItems: items.length,
      items,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
