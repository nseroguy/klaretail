import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const rawCookie =
      req.cookies.get('staff_session')?.value ||
      req.cookies.get('session_token')?.value ||
      req.cookies.get('klaretail_session')?.value;

    let sessionSlug = req.nextUrl.searchParams.get('vendorSlug') || req.cookies.get('vendorSlug')?.value || null;
    if (!sessionSlug && rawCookie) {
      try {
        let dec = rawCookie;
        while (dec.includes('%')) dec = decodeURIComponent(dec);
        const parsed = JSON.parse(dec);
        sessionSlug = parsed.vendorSlug || parsed.slug || null;
      } catch {}
    }
    const currentSlug = sessionSlug || 'bonus-store-kololo';

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
        p.base_price::numeric AS "rawBasePrice",
        p.stock_quantity AS "stockUnitsAvailable",
        p.image_url AS "imageUrl"
      FROM products p
      JOIN vendors v ON p.vendor_id = v.id
      WHERE p.is_available = true
        AND v.slug != ${currentSlug}
      ORDER BY p.created_at DESC;
    `);

    const items = Array.isArray(productsList) ? productsList : productsList?.rows || [];

    const mappedItems = items.map((item: any) => {
      const rawPrice = Number(item.rawBasePrice || 0);
      // 1% embedded listing buffer (100 bps)
      const markupAmount = Math.round(rawPrice * 0.01);
      const visibleTierPrice = rawPrice + markupAmount;

      return {
        id: item.id,
        productId: item.productId,
        name: item.name,
        category: item.category,
        wholesalerId: item.wholesalerId,
        wholesalerName: item.wholesalerName,
        unitOfMeasure: item.unitOfMeasure,
        minOrderQuantity: Number(item.minOrderQuantity || 1),
        stockUnitsAvailable: Number(item.stockUnitsAvailable || 0),
        imageUrl: item.imageUrl,
        // Visible customer-facing price (inclusive of 1% buffer)
        tierPrice: visibleTierPrice,
        // Internal audit & settlement fields
        rawWholesalePrice: rawPrice,
        listingMarkupAmount: markupAmount,
        catalogMarkupBps: 100,
      };
    });

    return NextResponse.json({
      success: true,
      pricingPolicy: {
        markupBps: 100,
        description: 'Displayed tierPrice includes embedded 1% platform listing buffer.',
      },
      items: mappedItems,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
