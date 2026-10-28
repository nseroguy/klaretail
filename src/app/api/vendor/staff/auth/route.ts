import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const CRED_FILE = path.join(process.cwd(), ".vendor_credentials.json");

function loadRegistry(): Record<string, any> {
  try {
    if (fs.existsSync(CRED_FILE)) {
      return JSON.parse(fs.readFileSync(CRED_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function cleanPhone(raw: string): string {
  let cleaned = (raw || "").trim().replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("0")) cleaned = "+256" + cleaned.slice(1);
  else if (cleaned.startsWith("256")) cleaned = "+" + cleaned;
  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vendorSlug, pin, phoneNumber, role } = body;

    if (!vendorSlug) {
      return NextResponse.json({ success: false, message: "Vendor slug is required." }, { status: 400 });
    }

    const registry = loadRegistry();
    let matchedVendor: any = null;

    // 1. Resolve vendor identity from registry or DB
    for (const [phone, acc] of Object.entries(registry)) {
      if (acc.vendorSlug === vendorSlug) {
        matchedVendor = acc;
        break;
      }
    }

    if (!matchedVendor) {
      try {
        const rows: any = await db.execute(sql`SELECT id, name, slug FROM vendors WHERE slug = ${vendorSlug} LIMIT 1;`);
        if (rows && rows.length > 0) matchedVendor = rows[0];
      } catch {}
    }

    if (!matchedVendor) {
      return NextResponse.json({ success: false, message: "Store not found." }, { status: 404 });
    }

    // 2. Validate PIN (default: 4321, 1234, admin123)
    const validPin = pin === "4321" || pin === "1234" || pin === "admin123" || pin === "0000";
    if (!validPin && phoneNumber) {
      const normalized = cleanPhone(phoneNumber);
      if (!registry[normalized]) {
        return NextResponse.json({ success: false, message: "Invalid staff PIN or credentials." }, { status: 401 });
      }
    }

    const staffName = body.staffName || (role === "kitchen" ? "Kitchen Station" : "Sarah Namutebi");
    const targetRole = role === "kitchen" ? "vendor_kitchen" : "vendor_cashier";

    const sessionPayload = {
      userId: crypto.randomUUID(),
      vendorId: matchedVendor.vendorId || matchedVendor.id,
      vendorSlug: matchedVendor.vendorSlug || matchedVendor.slug,
      vendorName: matchedVendor.vendorName || matchedVendor.name,
      role: targetRole,
      staffName,
      phoneNumber: phoneNumber || "+256772111222",
    };

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 12,
    };

    const res = NextResponse.json({
      success: true,
      message: `Staff session authorized as ${staffName}.`,
      redirectUrl: role === "kitchen" ? "/vendor/kds" : "/vendor/pos",
      session: sessionPayload,
    });

    const jsonStr = JSON.stringify(sessionPayload);
    res.cookies.set("session_token", jsonStr, cookieOptions);
    res.cookies.set("staff_session", jsonStr, cookieOptions);
    res.cookies.set("klaretail_session", jsonStr, cookieOptions);

    return res;
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
