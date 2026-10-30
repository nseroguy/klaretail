import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getActiveVendor } from "@/lib/vendor-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const vendor: any = await getActiveVendor(req);
    if (!vendor) {
      return NextResponse.json({ success: false, message: "Vendor session not found." }, { status: 404 });
    }

    const result: any = await db.execute(sql`
      SELECT 
        id::text AS id,
        vendor_id::text AS "vendorId",
        name,
        COALESCE(description, '') AS description,
        COALESCE(sku, '') AS sku,
        COALESCE(barcode, '') AS barcode,
        COALESCE(category, 'General') AS category,
        COALESCE(base_price, 0)::numeric AS "basePrice",
        COALESCE(cost_price, 0)::numeric AS "costPrice",
        COALESCE(wholesale_price, 0)::numeric AS "wholesalePrice",
        COALESCE(moq, 1)::int AS "moq",
        COALESCE(weight_kg, 1.0)::numeric AS "weightKg",
        COALESCE(tier_pricing, '[]'::jsonb) AS "tierPricing",
        COALESCE(stock_quantity, 0)::int AS "stockQuantity",
        COALESCE(track_inventory, false)::boolean AS "trackInventory",
        COALESCE(requires_kitchen_prep, true)::boolean AS "requiresKitchenPrep",
        COALESCE(is_available, true)::boolean AS "isAvailable",
        image_url AS "imageUrl",
        created_at AS "createdAt"
      FROM products
      WHERE vendor_id = ${vendor.id}::uuid
      ORDER BY created_at DESC;
    `);

    const products = Array.isArray(result) ? result : (result?.rows || []);

    return NextResponse.json({
      success: true,
      vendor: { id: vendor.id, name: vendor.name, slug: vendor.slug },
      products,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const vendor: any = await getActiveVendor(req);
    if (!vendor) {
      return NextResponse.json({ success: false, message: "Vendor session not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      name,
      basePrice,
      priceCents,
      costPrice,
      wholesalePrice,
      moq,
      weightKg,
      tierPricing,
      imageUrl,
      category,
      sku,
      barcode,
      description,
      stockQuantity,
      trackInventory,
      requiresKitchenPrep,
      isAvailable
    } = body;

    const rawPrice = basePrice !== undefined ? basePrice : priceCents;
    if (!name || rawPrice === undefined || rawPrice === "") {
      return NextResponse.json(
        { success: false, message: "Product name and base price are required." },
        { status: 400 }
      );
    }

    const parsedPrice = parseFloat(rawPrice) || 0;
    const parsedCost = parseFloat(costPrice) || 0;
    const parsedStock = parseInt(stockQuantity, 10) || 0;

    const insertRes: any = await db.execute(sql`
      INSERT INTO products (
        id,
        vendor_id,
        name,
        description,
        sku,
        barcode,
        category,
        base_price,
        cost_price,
        wholesale_price,
        moq,
        weight_kg,
        tier_pricing,
        image_url,
        stock_quantity,
        track_inventory,
        requires_kitchen_prep,
        is_available
      ) VALUES (
        ${crypto.randomUUID()}::uuid,
        ${vendor.id}::uuid,
        ${name.trim()},
        ${description ? description.trim() : null},
        ${sku ? sku.trim() : null},
        ${barcode ? barcode.trim() : null},
        ${category ? category.trim() : 'General'},
        ${parsedPrice},
        ${parsedCost},
        ${wholesalePrice ? parseFloat(wholesalePrice) : null},
        ${moq ? parseInt(moq, 10) : 1},
        ${weightKg ? parseFloat(weightKg) : 1.0},
        ${tierPricing ? JSON.stringify(tierPricing) : '[]'}::jsonb,
        ${imageUrl ? imageUrl.trim() : null},
        ${parsedStock},
        ${Boolean(trackInventory)},
        ${requiresKitchenPrep !== undefined ? Boolean(requiresKitchenPrep) : true},
        ${isAvailable !== undefined ? Boolean(isAvailable) : true}
      )
      RETURNING 
        id::text AS id,
        vendor_id::text AS "vendorId",
        name,
        base_price::numeric AS "basePrice",
        is_available AS "isAvailable";
    `);

    const newProduct = Array.isArray(insertRes) ? insertRes[0] : insertRes?.rows?.[0];
    return NextResponse.json({ success: true, product: newProduct });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const vendor: any = await getActiveVendor(req);
    if (!vendor) {
      return NextResponse.json({ success: false, message: "Vendor session not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      id,
      name,
      basePrice,
      priceCents,
      costPrice,
      wholesalePrice,
      moq,
      weightKg,
      tierPricing,
      imageUrl,
      category,
      sku,
      barcode,
      description,
      stockQuantity,
      trackInventory,
      requiresKitchenPrep,
      isAvailable
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "Product ID is required." }, { status: 400 });
    }

    // Single availability toggle shortcut
    if (isAvailable !== undefined && !name && basePrice === undefined) {
      const toggleRes: any = await db.execute(sql`
        UPDATE products
        SET is_available = ${Boolean(isAvailable)}, updated_at = NOW()
        WHERE id = ${id}::uuid AND vendor_id = ${vendor.id}::uuid
        RETURNING id::text AS id, is_available AS "isAvailable";
      `);
      const updated = Array.isArray(toggleRes) ? toggleRes[0] : toggleRes?.rows?.[0];
      return NextResponse.json({ success: true, product: updated });
    }

    // Full product edit
    const rawPrice = basePrice !== undefined ? basePrice : priceCents;
    const parsedPrice = rawPrice !== undefined ? (parseFloat(rawPrice) || 0) : null;
    const parsedCost = costPrice !== undefined ? (parseFloat(costPrice) || 0) : null;
    const parsedStock = stockQuantity !== undefined ? (parseInt(stockQuantity, 10) || 0) : null;

    const updateRes: any = await db.execute(sql`
      UPDATE products
      SET 
        name = COALESCE(${name ? name.trim() : null}, name),
        description = COALESCE(${description ? description.trim() : null}, description),
        sku = COALESCE(${sku ? sku.trim() : null}, sku),
        barcode = COALESCE(${barcode ? barcode.trim() : null}, barcode),
        category = COALESCE(${category ? category.trim() : null}, category),
        base_price = COALESCE(${parsedPrice}, base_price),
        cost_price = COALESCE(${parsedCost}, cost_price),
        wholesale_price = COALESCE(${wholesalePrice !== undefined && wholesalePrice !== null && wholesalePrice !== '' ? parseFloat(wholesalePrice) : null}, wholesale_price),
        moq = COALESCE(${moq !== undefined && moq !== null && moq !== '' ? parseInt(moq, 10) : null}, moq),
        weight_kg = COALESCE(${weightKg !== undefined && weightKg !== null && weightKg !== '' ? parseFloat(weightKg) : null}, weight_kg),
        image_url = COALESCE(${imageUrl !== undefined ? (imageUrl ? imageUrl.trim() : null) : null}, image_url),
        tier_pricing = COALESCE(${tierPricing !== undefined ? JSON.stringify(tierPricing) : null}::jsonb, tier_pricing),
        stock_quantity = COALESCE(${parsedStock}, stock_quantity),
        track_inventory = COALESCE(${trackInventory !== undefined ? Boolean(trackInventory) : null}, track_inventory),
        requires_kitchen_prep = COALESCE(${requiresKitchenPrep !== undefined ? Boolean(requiresKitchenPrep) : null}, requires_kitchen_prep),
        is_available = COALESCE(${isAvailable !== undefined ? Boolean(isAvailable) : null}, is_available),
        updated_at = NOW()
      WHERE id = ${id}::uuid AND vendor_id = ${vendor.id}::uuid
      RETURNING 
        id::text AS id,
        vendor_id::text AS "vendorId",
        name,
        base_price::numeric AS "basePrice",
        is_available AS "isAvailable";
    `);

    const updated = Array.isArray(updateRes) ? updateRes[0] : updateRes?.rows?.[0];
    return NextResponse.json({ success: true, product: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
