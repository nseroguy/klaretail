import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, vendorTables, tableSessions, vendors } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tableNumber, items, vendorSlug, guestCount, paymentMethod } = body;

    if (!tableNumber || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Valid table number and items are required." },
        { status: 400 }
      );
    }

    // 1. Resolve vendor: by slug first, or fallback to first vendor in DB
    let vendor: any = null;
    if (vendorSlug) {
      vendor = await db.query.vendors.findFirst({
        where: sql`LOWER(${vendors.slug}) = LOWER(${vendorSlug})`,
      });
    }

    if (!vendor) {
      vendor = await db.query.vendors.findFirst({
        where: sql`LOWER(${vendors.slug}) LIKE '%bourbon%'`,
      });
    }

    if (!vendor) {
      vendor = await db.query.vendors.findFirst();
    }

    if (!vendor) {
      return NextResponse.json({ success: false, message: "Vendor not found in database." }, { status: 404 });
    }

    // 2. Resolve Table Record (e.g., T-04 or T-4)
    const cleanTableNum = String(tableNumber).trim().toUpperCase();
    const altTableNum = cleanTableNum.startsWith("T-") 
      ? `T-${parseInt(cleanTableNum.replace("T-", ""), 10)}` 
      : cleanTableNum;

    let table = await db.query.vendorTables.findFirst({
      where: sql`${vendorTables.vendorId} = ${vendor.id} AND (${vendorTables.tableNumber} = ${cleanTableNum} OR ${vendorTables.tableNumber} = ${altTableNum})`,
    });

    // If table doesn't exist yet, auto-provision it for the vendor
    if (!table) {
      const [newTable] = await db
        .insert(vendorTables)
        .values({
          vendorId: vendor.id,
          tableNumber: cleanTableNum,
          seatingCapacity: 4,
          qrToken: `QR-${vendor.slug}-${cleanTableNum}`,
          isActive: true,
        } as any)
        .returning();
      table = newTable;
    }

    // 3. Resolve or Initialize Open Table Session
    let session = await db.query.tableSessions.findFirst({
      where: sql`${tableSessions.tableId} = ${table.id} AND ${tableSessions.status} = 'open'`,
    });

    if (!session) {
      const [newSession] = await db
        .insert(tableSessions)
        .values({
          vendorId: vendor.id,
          tableId: table.id,
          status: "open",
          guestCount: Number(guestCount) || 2,
          openedAt: new Date(),
        } as any)
        .returning();
      session = newSession;
    }

    const subtotal = items.reduce(
      (sum: number, it: any) => sum + Number(it.unitPrice) * Number(it.quantity),
      0
    );
    const generatedOrderNumber = `TAB-${table.tableNumber}-${Date.now().toString().slice(-4)}`;

    // 4. Commit Dine-in Order
    const result = await db.transaction(async (tx) => {
      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderNumber: generatedOrderNumber,
          vendorId: vendor.id,
          tableId: table.id,
          tableSessionId: session.id,
          fulfillmentType: "dine_in",
          status: "accepted", // Immediately alerts KDS
          productSubtotal: subtotal,
          deliveryFee: 0,
          serviceFee: 0,
          damageProtectionFee: 0,
          convenienceFee: 0,
          totalAmount: subtotal,
          paymentMethod: paymentMethod || "COD",
          codAmountDue: paymentMethod === "COD" ? subtotal : 0,
          codCashReceived: 0,
          updatedAt: new Date(),
        } as any)
        .returning();

      for (const item of items) {
        await tx.insert(orderItems).values({
          orderId: newOrder.id,
          productId: String(item.productId || `ITEM-${Date.now()}`),
          name: item.name,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.unitPrice) * (Number(item.quantity) || 1),
          selectedModifiers: item.selectedModifiers || [],
          kitchenNotes: item.kitchenNotes || null,
        } as any);
      }

      return newOrder;
    });

    return NextResponse.json({
      success: true,
      order: result,
      tableNumber: table.tableNumber,
    });
  } catch (error: any) {
    console.error("[TABLE_ORDER_ERROR]:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to submit table order." },
      { status: 500 }
    );
  }
}
