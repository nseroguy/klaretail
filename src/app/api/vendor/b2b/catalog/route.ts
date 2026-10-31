import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const productsList: any = await db.execute(sql`
      SELECT 
        p.id,
        p.id AS "productId",
        p.name,
        p.category,
        p.vendor_id AS "wholesalerId",
        v.name AS "wholesalerName",
        'crates' AS "unitOfMeasure",
        1 AS "minOrderQuantity",
        p.base_price::numeric AS "tierPrice",
        p.stock_quantity AS "stockUnitsAvailable",
        p.image_url AS "imageUrl"
      FROM products p
      JOIN vendors v ON p.vendor_id = v.id
      WHERE p.is_available = true
        AND v.slug != COALESCE(${req.nextUrl.searchParams.get('vendorSlug') || req.cookies.get('vendorSlug')?.value || null}, 'bonus-store-kololo')
      ORDER BY p.created_at DESC;
    `);

    const items = Array.isArray(productsList) ? productsList : productsList?.rows || [];

    return NextResponse.json({
      success: true,
      items: items.map((item: any) => ({
        ...item,
        tierPrice: Number(item.tierPrice),
        minOrderQuantity: Number(item.minOrderQuantity || 1),
        stockUnitsAvailable: Number(item.stockUnitsAvailable || 0),
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
