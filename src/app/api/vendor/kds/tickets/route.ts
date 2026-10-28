import { NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, vendorTables, users } from "@/db/schema";
import { eq, inArray, desc, and, sql } from "drizzle-orm";

export async function GET(req: any) {
  try {

    // 0. Resolve active vendor from session
    let session: any = null;
    const rawCookie = req.cookies?.get?.("staff_session")?.value || req.cookies?.get?.("session_token")?.value;
    if (rawCookie) {
      try {
        let dec = rawCookie;
        while (dec.includes("%")) dec = decodeURIComponent(dec);
        session = JSON.parse(dec);
      } catch {}
    }

    const targetVendorId = session?.vendorId || session?.vendor_id;
    const targetSlug = session?.vendorSlug || session?.vendor_slug;

    let vendorWhereClause: any = null;
    if (targetVendorId) {
      vendorWhereClause = eq(orders.vendorId, targetVendorId);
    } else if (targetSlug) {
      vendorWhereClause = sql`${orders.vendorId} IN (SELECT id FROM vendors WHERE slug = ${targetSlug})`;
    }

    // 1. Fetch active tickets in prep lifecycle
    const rawOrders = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        fulfillmentType: orders.fulfillmentType,
        status: orders.status,
        createdAt: orders.createdAt,
        tableNumber: vendorTables.tableNumber,
        waiterPhone: users.phone,
      })
      .from(orders)
      .leftJoin(vendorTables, eq(orders.tableId, vendorTables.id))
      .leftJoin(users, eq(orders.waiterId, users.id))
      .where(
        vendorWhereClause 
          ? and(inArray(orders.status, ["accepted", "preparing", "scheduled_confirmed"]), vendorWhereClause)
          : inArray(orders.status, ["accepted", "preparing", "scheduled_confirmed"])
      )
      .orderBy(desc(orders.createdAt));

    if (rawOrders.length === 0) {
      return NextResponse.json({ success: true, tickets: [] });
    }

    const orderIds = rawOrders.map((o) => o.id);

    // 2. Fetch line items
    const rawItems = await db
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    const tickets = rawOrders.map((ord) => ({
      ...ord,
      waiterName: ord.waiterPhone ? `Staff (${ord.waiterPhone.slice(-4)})` : "Counter",
      items: rawItems
        .filter((it) => it.orderId === ord.id)
        .map((it) => ({
          id: it.id,
          name: it.name,
          quantity: it.quantity,
          selectedModifiers: it.selectedModifiers || [],
          kitchenNotes: it.kitchenNotes || null,
        })),
    }));

    return NextResponse.json({ success: true, tickets });
  } catch (error: any) {
    console.error("[KDS_TICKETS_ERROR]:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
