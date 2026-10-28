import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, vendors } from "@/db/schema";
import { sql } from "drizzle-orm";
import { getActiveVendor } from "@/lib/vendor-session";

export async function GET(req: NextRequest) {
  try {
    const vendor: any = await getActiveVendor(req);
    if (!vendor) {
      return NextResponse.json({ success: false, message: "Vendor not found." }, { status: 404 });
    }

    const vendorProducts = await db.query.products.findMany({
      where: sql`${products.vendorId} = ${vendor.id}`,
    });

    return NextResponse.json({
      success: true,
      vendor: { id: vendor.id, name: vendor.name, slug: vendor.slug },
      products: vendorProducts || [],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const vendor: any = await getActiveVendor(req);
    if (!vendor) {
      return NextResponse.json({ success: false, message: "Vendor not found." }, { status: 404 });
    }

    const body = await req.json();
    const { name, priceCents, categoryId, isAvailable, barcode, sku } = body;

    if (!name || priceCents === undefined) {
      return NextResponse.json(
        { success: false, message: "Product name and price are required." },
        { status: 400 }
      );
    }

    const [newProduct] = await db
      .insert(products)
      .values({
        vendorId: vendor.id,
        name: name.trim(),
        priceCents: Math.round(Number(priceCents)),
        categoryId: categoryId || null,
        isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
        barcode: barcode || null,
        sku: sku || null,
      } as any)
      .returning();

    return NextResponse.json({ success: true, product: newProduct });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
