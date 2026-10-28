import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { vendors } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subCategory = searchParams.get("subCategory");
    const sector = searchParams.get("sector");

    let condition = sql`1=1`;

    if (subCategory && subCategory !== "all") {
      condition = sql`${condition} AND ${vendors.subCategory} = ${subCategory}`;
    }

    if (sector && sector !== "all") {
      condition = sql`${condition} AND ${vendors.sector} = ${sector}`;
    }

    const allVendors = await db
      .select({
        id: vendors.id,
        name: vendors.name,
        slug: vendors.slug,
        sector: vendors.sector,
        subCategory: vendors.subCategory,
        serviceType: vendors.serviceType,
        enableTableOrdering: vendors.enableTableOrdering,
        enableQrOrdering: vendors.enableQrOrdering,
        isAcceptingOrders: vendors.isAcceptingOrders,
      })
      .from(vendors)
      .where(condition)
      .orderBy(vendors.name);

    return NextResponse.json({ success: true, vendors: allVendors });
  } catch (error: any) {
    console.error("[GET_VENDORS_ERROR]:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load vendors." },
      { status: 500 }
    );
  }
}
