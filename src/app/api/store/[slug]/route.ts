import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { vendors, products } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    if (!slug) {
      return NextResponse.json({ success: false, message: "Vendor slug required." }, { status: 400 });
    }

    const vendor = await db.query.vendors.findFirst({
      where: sql`LOWER(${vendors.slug}) = LOWER(${slug})`,
    });

    if (!vendor) {
      return NextResponse.json({ success: false, message: "Vendor not found." }, { status: 404 });
    }

    // Load active products belonging to this vendor
    const catalogProducts = await db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        price: products.basePrice,
        sku: products.sku,
        category: products.category,
        imageUrl: products.imageUrl,
        isAvailable: products.isAvailable,
        requiresKitchenPrep: products.requiresKitchenPrep,
      })
      .from(products)
      .where(sql`${products.vendorId} = ${vendor.id} AND ${products.isAvailable} = true`)
      .orderBy(sql`${products.category} ASC, ${products.name} ASC`);

    return NextResponse.json({
      success: true,
      vendor: {
        id: vendor.id,
        name: vendor.name,
        slug: vendor.slug,
        sector: (vendor as any).sector || "food_beverage",
        subCategory: (vendor as any).subCategory || "restaurant",
        serviceType: (vendor as any).serviceType || "dine_in_hybrid",
        enableTableOrdering: (vendor as any).enableTableOrdering ?? true,
        enableQrOrdering: (vendor as any).enableQrOrdering ?? true,
        isAcceptingOrders: vendor.isAcceptingOrders,
      },
      products: catalogProducts,
    });
  } catch (error: any) {
    console.error("[VENDOR_CATALOG_ERROR]:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to load storefront catalog." },
      { status: 500 }
    );
  }
}
