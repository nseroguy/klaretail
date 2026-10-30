import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getActiveVendor } from "@/lib/vendor-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const vendor: any = await getActiveVendor(req);
    if (!vendor) {
      return NextResponse.json({ success: false, message: "Vendor session missing" }, { status: 404 });
    }

    const res: any = await db.execute(sql`
      SELECT 
        id::text AS id,
        name,
        slug,
        service_type::text AS "serviceType",
        default_slot_capacity AS "defaultSlotCapacity",
        is_accepting_orders AS "isAcceptingOrders",
        enable_table_ordering AS "enableTableOrdering",
        enable_qr_ordering AS "enableQrOrdering",
        commission_bps AS "commissionBps",
        payout_status AS "payoutStatus",
        latitude::text AS latitude,
        longitude::text AS longitude
      FROM vendors
      WHERE id = ${vendor.id}::uuid
      LIMIT 1;
    `);

    const data = Array.isArray(res) ? res[0] : res?.rows?.[0];
    return NextResponse.json({ success: true, settings: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const vendor: any = await getActiveVendor(req);
    if (!vendor) {
      return NextResponse.json({ success: false, message: "Vendor session missing" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const updates: any[] = [];

    if (body.name && typeof body.name === "string") {
      updates.push(sql`name = ${body.name.trim()}`);
    }
    if (body.serviceType) {
      updates.push(sql`service_type = ${body.serviceType}::text::service_type`);
    }
    if (body.defaultSlotCapacity !== undefined && body.defaultSlotCapacity !== null && body.defaultSlotCapacity !== "") {
      updates.push(sql`default_slot_capacity = ${Number(body.defaultSlotCapacity)}`);
    }
    if (body.isAcceptingOrders !== undefined && body.isAcceptingOrders !== null) {
      updates.push(sql`is_accepting_orders = ${Boolean(body.isAcceptingOrders)}`);
    }
    if (body.enableTableOrdering !== undefined && body.enableTableOrdering !== null) {
      updates.push(sql`enable_table_ordering = ${Boolean(body.enableTableOrdering)}`);
    }
    if (body.enableQrOrdering !== undefined && body.enableQrOrdering !== null) {
      updates.push(sql`enable_qr_ordering = ${Boolean(body.enableQrOrdering)}`);
    }
    if (body.latitude !== undefined && body.latitude !== null && body.latitude !== "") {
      updates.push(sql`latitude = ${Number(body.latitude)}`);
    }
    if (body.longitude !== undefined && body.longitude !== null && body.longitude !== "") {
      updates.push(sql`longitude = ${Number(body.longitude)}`);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: true, message: "No settings changes provided." });
    }

    const setClause = sql.join(updates, sql`, `);
    const query = sql`
      UPDATE vendors
      SET ${setClause}
      WHERE id = ${vendor.id}::uuid
      RETURNING 
        id::text AS id,
        name,
        service_type::text AS "serviceType",
        default_slot_capacity AS "defaultSlotCapacity",
        is_accepting_orders AS "isAcceptingOrders",
        enable_table_ordering AS "enableTableOrdering",
        enable_qr_ordering AS "enableQrOrdering";
    `;

    const res: any = await db.execute(query);
    const updated = Array.isArray(res) ? res[0] : res?.rows?.[0];

    return NextResponse.json({
      success: true,
      message: "Settings updated successfully.",
      settings: updated
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return PUT(req);
}
