import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const CRED_FILE = path.join(process.cwd(), ".vendor_credentials.json");

// GET /api/admin/operations?vendorId=... -> fetch vendor details + products
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get("vendorId");

    if (vendorId) {
      const vendorResult: any = await db.execute(sql`
        SELECT * FROM vendors WHERE id::text = ${vendorId} OR slug = ${vendorId};
      `);
      const productsResult: any = await db.execute(sql`
        SELECT id, vendor_id, name, description, sku, barcode, category, 
               base_price, cost_price, stock_quantity, track_inventory, 
               requires_kitchen_prep, is_available, created_at, updated_at
        FROM products 
        WHERE vendor_id::text = ${vendorId} 
           OR vendor_id IN (SELECT id FROM vendors WHERE slug = ${vendorId})
        ORDER BY created_at DESC;
      `);

      return NextResponse.json({
        success: true,
        vendor: (vendorResult.rows || vendorResult)[0] || null,
        products: productsResult.rows || productsResult || [],
      });
    }

    // Overview of all vendors with product counts
    const overview: any = await db.execute(sql`
      SELECT v.id, v.name, v.slug, v.status, v.is_approved, v.is_accepting_orders, v.sector, v.sub_category,
             COUNT(p.id) AS product_count
      FROM vendors v
      LEFT JOIN products p ON p.vendor_id = v.id
      GROUP BY v.id
      ORDER BY v.created_at DESC;
    `);

    return NextResponse.json({
      success: true,
      vendors: overview.rows || overview,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST /api/admin/operations -> update vendor, update/delete product, bulk price adjust
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // --- SUPER ADMIN EMERGENCY ACTIONS ---
    if (action === 'force_settle_order') {
      const { orderId, reason = 'Super Admin Force Settlement' } = body;
      if (!orderId) {
        return NextResponse.json({ success: false, message: 'orderId is required' }, { status: 400 });
      }

      // Fetch order details
      const [orderResult]: any = await db.execute(sql`SELECT * FROM orders WHERE id::text = ${orderId} LIMIT 1`);
      const order = Array.isArray(orderResult) ? orderResult[0] : (orderResult?.rows?.[0] || orderResult);

      if (!order) {
        return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
      }

      // Call internal verify-pin endpoint to run complete atomic settlement
      const verifyRes = await fetch("http://localhost:3000/api/orders/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          pin: order.delivery_pin || order.deliveryPin,
          cashCollected: (order.payment_method || order.paymentMethod) === 'cod' ? Number(order.cod_amount_due || order.total_amount || 0) : 0,
        }),
      });

      const verifyData = await verifyRes.json();
      return NextResponse.json({
        success: verifyRes.ok,
        message: verifyData.message || 'Order settled successfully via administrative override.',
        data: verifyData,
      });
    }

    if (action === 'reassign_rider') {
      const { orderId, newRiderId } = body;
      if (!orderId || !newRiderId) {
        return NextResponse.json({ success: false, message: 'orderId and newRiderId are required' }, { status: 400 });
      }

      await db.execute(sql`
        UPDATE orders 
        SET rider_id = ${newRiderId}::uuid, updated_at = NOW() 
        WHERE id::text = ${orderId}
      `);

      return NextResponse.json({
        success: true,
        message: 'Order courier successfully reassigned.',
      });
    }

    // 1. UPDATE VENDOR PROFILE
    if (action === "update_vendor") {
      const { vendorId, name, slug, sector, subCategory, commissionBps, isAcceptingOrders } = body;
      if (!vendorId) return NextResponse.json({ success: false, message: "vendorId required" }, { status: 400 });

      const vName = name !== undefined ? String(name) : null;
      const vSlug = slug !== undefined ? String(slug) : null;
      const vSector = sector !== undefined ? String(sector) : null;
      const vSub = subCategory !== undefined ? String(subCategory) : null;
      const vComm = commissionBps !== undefined ? Number(commissionBps) : null;
      const vAccept = isAcceptingOrders !== undefined ? Boolean(isAcceptingOrders) : null;

      await db.execute(sql`
        UPDATE vendors
        SET name = COALESCE(${vName}, name),
            slug = COALESCE(${vSlug}, slug),
            sector = COALESCE(${vSector}, sector),
            sub_category = COALESCE(${vSub}, sub_category),
            commission_bps = COALESCE(${vComm}, commission_bps),
            is_accepting_orders = COALESCE(${vAccept}, is_accepting_orders)
        WHERE id::text = ${vendorId} OR slug = ${vendorId};
      `);
      return NextResponse.json({ success: true, message: `Vendor ${vendorId} details updated.` });
    }

    // 2. DELETE VENDOR
    if (action === "delete_vendor") {
      const { vendorId } = body;
      if (!vendorId) return NextResponse.json({ success: false, message: "vendorId required" }, { status: 400 });

      // Clean local credentials registry
      try {
        if (fs.existsSync(CRED_FILE)) {
          const reg = JSON.parse(fs.readFileSync(CRED_FILE, "utf-8"));
          for (const k of Object.keys(reg)) {
            if (reg[k].vendorId === vendorId || reg[k].vendorSlug === vendorId) {
              delete reg[k];
            }
          }
          fs.writeFileSync(CRED_FILE, JSON.stringify(reg, null, 2), "utf-8");
        }
      } catch {}

      // Delete from DB
      await db.execute(sql`DELETE FROM products WHERE vendor_id::text = ${vendorId} OR vendor_id IN (SELECT id FROM vendors WHERE slug = ${vendorId});`);
      await db.execute(sql`DELETE FROM vendors WHERE id::text = ${vendorId} OR slug = ${vendorId};`);

      return NextResponse.json({ success: true, message: `Vendor ${vendorId} and its catalog removed.` });
    }

    // 3. ADJUST PRODUCT (Price, Stock, Availability, Name)
    if (action === "update_product") {
      const { productId, name, price, basePrice, costPrice, stock, stockQuantity, isAvailable, category } = body;
      if (!productId) return NextResponse.json({ success: false, message: "productId or sku required" }, { status: 400 });

      const pName = name !== undefined ? String(name) : null;
      const pPrice = (price !== undefined || basePrice !== undefined) ? String(price ?? basePrice) : null;
      const pCost = costPrice !== undefined ? String(costPrice) : null;
      const pStock = (stock !== undefined || stockQuantity !== undefined) ? Number(stock ?? stockQuantity) : null;
      const pAvail = isAvailable !== undefined ? Boolean(isAvailable) : null;
      const pCategory = category !== undefined ? String(category) : null;

      await db.execute(sql`
        UPDATE products
        SET name = COALESCE(${pName}, name),
            base_price = COALESCE(${pPrice}, base_price),
            cost_price = COALESCE(${pCost}, cost_price),
            stock_quantity = COALESCE(${pStock}, stock_quantity),
            is_available = COALESCE(${pAvail}, is_available),
            category = COALESCE(${pCategory}, category),
            updated_at = NOW()
        WHERE id::text = ${productId} OR sku = ${productId};
      `);

      return NextResponse.json({
        success: true,
        message: `Product ${productId} updated successfully.`,
      });
    }

    // 4. CREATE NEW PRODUCT UNDER VENDOR (Super Admin Quick Insert)
    if (action === "create_product") {
      const { vendorId, name, price, basePrice, sku, category, stockQuantity, requiresKitchenPrep } = body;
      if (!vendorId || !name) {
        return NextResponse.json({ success: false, message: "vendorId and name are required." }, { status: 400 });
      }

      const assignedPrice = String(price ?? basePrice ?? 0);
      const assignedSku = sku || `SKU-${Date.now().toString().slice(-6)}`;
      const assignedCat = category || "General";
      const assignedStock = Number(stockQuantity ?? 100);
      const isPrep = Boolean(requiresKitchenPrep);

      const inserted: any = await db.execute(sql`
        INSERT INTO products (
          id, vendor_id, name, sku, base_price, category, stock_quantity, track_inventory, requires_kitchen_prep, is_available
        ) VALUES (
          gen_random_uuid(),
          (SELECT id FROM vendors WHERE id::text = ${vendorId} OR slug = ${vendorId} LIMIT 1),
          ${name},
          ${assignedSku},
          ${assignedPrice},
          ${assignedCat},
          ${assignedStock},
          true,
          ${isPrep},
          true
        ) RETURNING id, name, sku, base_price, category;
      `);

      return NextResponse.json({
        success: true,
        message: "Product created successfully.",
        product: (inserted.rows || inserted)[0],
      });
    }

    // 5. DELETE PRODUCT
    if (action === "delete_product") {
      const { productId } = body;
      if (!productId) return NextResponse.json({ success: false, message: "productId required" }, { status: 400 });

      await db.execute(sql`DELETE FROM products WHERE id::text = ${productId} OR sku = ${productId};`);
      return NextResponse.json({ success: true, message: `Product ${productId} deleted.` });
    }

    // 6. BULK PRICE ADJUSTMENT (e.g. +10% inflation or sale)
    if (action === "bulk_adjust_prices") {
      const { vendorId, multiplier } = body;
      if (!vendorId || !multiplier) {
        return NextResponse.json({ success: false, message: "vendorId and multiplier required" }, { status: 400 });
      }

      await db.execute(sql`
        UPDATE products
        SET base_price = ROUND((base_price * ${Number(multiplier)})::numeric, 0),
            updated_at = NOW()
        WHERE vendor_id::text = ${vendorId} OR vendor_id IN (SELECT id FROM vendors WHERE slug = ${vendorId});
      `);

      return NextResponse.json({
        success: true,
        message: `Prices adjusted for vendor ${vendorId} by multiplier ${multiplier}.`,
      });
    }

    return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
