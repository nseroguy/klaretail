import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const rawCookie =
      req.cookies.get("session_token")?.value ||
      req.cookies.get("staff_session")?.value;

    if (!rawCookie) {
      return NextResponse.json({ success: false, message: "Unauthenticated" }, { status: 401 });
    }

    let dec = rawCookie;
    while (dec.includes("%")) dec = decodeURIComponent(dec);
    const session = JSON.parse(dec);

    const vendorId = session.vendorId || session.id;
    if (!vendorId) {
      return NextResponse.json({ success: false, message: "Vendor ID missing" }, { status: 400 });
    }

    // Fetch vendor identity
    const vendorRes: any = await db.execute(sql`
      SELECT id, name, slug, service_type AS "serviceType"
      FROM vendors
      WHERE id = ${vendorId}::uuid
      LIMIT 1;
    `);
    const vendor = Array.isArray(vendorRes) ? vendorRes[0] : vendorRes?.rows?.[0];

    // Compute today's revenue and completed ticket count
    const statsRes: any = await db.execute(sql`
      SELECT 
        COALESCE(SUM(total_amount), 0)::numeric AS "todayRevenue",
        COUNT(*)::int AS "ordersCount"
      FROM orders
      WHERE vendor_id = ${vendorId}::uuid
        AND created_at >= CURRENT_DATE;
    `);
    const metrics = Array.isArray(statsRes) ? statsRes[0] : statsRes?.rows?.[0];

    // Count open active tables
    let openTablesCount = 0;
    try {
      const tablesRes: any = await db.execute(sql`
        SELECT COUNT(*)::int AS count 
        FROM vendor_tables 
        WHERE vendor_id = ${vendorId}::uuid AND is_occupied = true;
      `);
      const tableRow = Array.isArray(tablesRes) ? tablesRes[0] : tablesRes?.rows?.[0];
      openTablesCount = Number(tableRow?.count || 0);
    } catch {}

    // Count active kitchen tickets
    let kitchenCount = 0;
    try {
      const kdsRes: any = await db.execute(sql`
        SELECT COUNT(*)::int AS count 
        FROM orders 
        WHERE vendor_id = ${vendorId}::uuid 
          AND status IN ('accepted', 'preparing');
      `);
      const kdsRow = Array.isArray(kdsRes) ? kdsRes[0] : kdsRes?.rows?.[0];
      kitchenCount = Number(kdsRow?.count || 0);
    } catch {}

    return NextResponse.json({
      success: true,
      stats: {
        vendorName: vendor?.name || session.vendorName || "Store Dashboard",
        slug: vendor?.slug || session.vendorSlug || "",
        serviceType: vendor?.serviceType || "dine_in_hybrid",
        todayRevenue: Number(metrics?.todayRevenue || 0),
        ordersCount: Number(metrics?.ordersCount || 0),
        openTables: openTablesCount,
        activeKitchenTickets: kitchenCount
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
