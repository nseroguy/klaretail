import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

const CRED_FILE = path.join(process.cwd(), ".vendor_credentials.json");

// GET /api/admin/vendors - List all stores with their approval status
export async function GET() {
  try {
    const list: any = await db.execute(sql`
      SELECT id, name, slug, sector, sub_category, is_approved, status, created_at 
      FROM vendors 
      ORDER BY created_at DESC;
    `);

    return NextResponse.json({
      success: true,
      vendors: list.rows || list,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST /api/admin/vendors - Super Admin action: 'approve' | 'reject' | 'suspend'
export async function POST(req: NextRequest) {
  try {
    const { vendorId, action } = await req.json();

    if (!vendorId || !action) {
      return NextResponse.json(
        { success: false, message: "vendorId and action ('approve' | 'reject' | 'suspend') are required." },
        { status: 400 }
      );
    }

    const isApproved = action === "approve";
    const newStatus = action === "approve" ? "active" : action === "reject" ? "rejected" : "suspended";
    const accepting = action === "approve";

    // 1. Update PostgreSQL
    await db.execute(sql`
      UPDATE vendors 
      SET is_approved = ${isApproved}, 
          status = ${newStatus},
          is_accepting_orders = ${accepting}
      WHERE id::text = ${vendorId} OR slug = ${vendorId};
    `);

    // 2. Synchronize credentials JSON file
    try {
      if (fs.existsSync(CRED_FILE)) {
        const reg = JSON.parse(fs.readFileSync(CRED_FILE, "utf-8"));
        for (const phone of Object.keys(reg)) {
          if (reg[phone].vendorId === vendorId || reg[phone].vendorSlug === vendorId) {
            reg[phone].status = newStatus;
            reg[phone].isApproved = isApproved;
          }
        }
        fs.writeFileSync(CRED_FILE, JSON.stringify(reg, null, 2), "utf-8");
      }
    } catch (e) {
      console.warn("[ADMIN_APPROVAL] Local credential file sync note:", e);
    }

    return NextResponse.json({
      success: true,
      message: `Store ${vendorId} updated to '${newStatus}'.`,
      vendorId,
      status: newStatus,
      isApproved,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
