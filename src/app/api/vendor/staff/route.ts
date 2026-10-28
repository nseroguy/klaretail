import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getActiveVendor, parseVendorSession } from "@/lib/vendor-session";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const STAFF_FILE = path.join(process.cwd(), ".vendor_staff.json");
const CRED_FILE = path.join(process.cwd(), ".vendor_credentials.json");

function loadLocalStaff(): any[] {
  try {
    if (fs.existsSync(STAFF_FILE)) {
      return JSON.parse(fs.readFileSync(STAFF_FILE, "utf-8"));
    }
  } catch {}
  return [];
}

function saveLocalStaff(staff: any[]) {
  try {
    fs.writeFileSync(STAFF_FILE, JSON.stringify(staff, null, 2), "utf-8");
  } catch {}
}

function updateCredentialRegistry(phone: string, pin: string, vendor: any, staffName: string) {
  try {
    let creds: any = {};
    if (fs.existsSync(CRED_FILE)) {
      creds = JSON.parse(fs.readFileSync(CRED_FILE, "utf-8"));
    }
    const hash = crypto.createHash("sha256").update(pin).digest("hex");
    creds[phone] = {
      passwordHash: hash,
      vendorId: vendor.id,
      vendorName: vendor.name,
      vendorSlug: vendor.slug,
      userId: crypto.randomUUID(),
      phoneNumber: phone,
      staffName,
    };
    fs.writeFileSync(CRED_FILE, JSON.stringify(creds, null, 2), "utf-8");
  } catch (e) {
    console.error("[STAFF] Error updating credentials:", e);
  }
}

// GET: List staff for active vendor
export async function GET(req: NextRequest) {
  try {
    const activeVendor: any = await getActiveVendor(req);
    if (!activeVendor) {
      return NextResponse.json({ success: false, message: "Vendor not found." }, { status: 404 });
    }

    let staffList: any[] = [];
    try {
      const rows: any = await db.execute(sql`
        SELECT id, vendor_id, full_name, phone_number, role, pos_pin, is_active, created_at
        FROM vendor_staff
        WHERE vendor_id = ${activeVendor.id}
        ORDER BY created_at DESC;
      `);
      if (rows && rows.length > 0) staffList = rows;
    } catch (e: any) {
      console.warn("[STAFF_GET] DB query failed, falling back to local file:", e.message);
    }

    if (staffList.length === 0) {
      const local = loadLocalStaff();
      staffList = local.filter((s) => s.vendorId === activeVendor.id || s.vendor_id === activeVendor.id);
    }

    return NextResponse.json({
      success: true,
      vendor: { id: activeVendor.id, name: activeVendor.name, slug: activeVendor.slug },
      staff: staffList,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST: Add new staff member
export async function POST(req: NextRequest) {
  try {
    const activeVendor: any = await getActiveVendor(req);
    if (!activeVendor) {
      return NextResponse.json({ success: false, message: "Vendor not found." }, { status: 404 });
    }

    const body = await req.json();
    const { fullName, name, phoneNumber, phone, role, posPin, pin, nationalIdNumber, emergencyContactPhone } = body;

    const staffFullName = (fullName || name || "").trim();
    let staffPhone = (phoneNumber || phone || "").trim().replace(/[\s\-\(\)]/g, "");
    if (staffPhone.startsWith("0")) staffPhone = "+256" + staffPhone.slice(1);
    else if (staffPhone.startsWith("256")) staffPhone = "+" + staffPhone;

    const staffPin = (posPin || pin || "1234").trim();
    const staffRole = role || "cashier"; // cashier, kitchen, waiter, vendor_admin

    if (!staffFullName || !staffPhone) {
      return NextResponse.json(
        { success: false, message: "Staff full name and phone number are required." },
        { status: 400 }
      );
    }

    const pinHash = crypto.createHash("sha256").update(staffPin).digest("hex");
    const staffId = crypto.randomUUID();
    let createdStaff: any = null;

    // 1. Try DB insertion with raw SQL to handle optional/missing columns
    try {
      const rows: any = await db.execute(sql`
        INSERT INTO vendor_staff (
          id, vendor_id, full_name, phone_number, role, pos_pin, password_hash, is_active
        ) VALUES (
          ${staffId}, ${activeVendor.id}, ${staffFullName}, ${staffPhone}, ${staffRole}, ${staffPin}, ${pinHash}, true
        )
        ON CONFLICT (vendor_id, phone_number) DO UPDATE
        SET full_name = ${staffFullName}, role = ${staffRole}, pos_pin = ${staffPin}, password_hash = ${pinHash}, is_active = true
        RETURNING *;
      `);
      if (rows && rows.length > 0) createdStaff = rows[0];
    } catch (dbErr: any) {
      console.warn("[STAFF_POST] DB insert failed, falling back to local file:", dbErr.message);
    }

    if (!createdStaff) {
      createdStaff = {
        id: staffId,
        vendorId: activeVendor.id,
        vendor_id: activeVendor.id,
        fullName: staffFullName,
        full_name: staffFullName,
        phoneNumber: staffPhone,
        phone_number: staffPhone,
        role: staffRole,
        posPin: staffPin,
        pos_pin: staffPin,
        isActive: true,
        is_active: true,
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
    }

    // 2. Persist in local staff file
    const local = loadLocalStaff();
    const existingIdx = local.findIndex((s) => s.phoneNumber === staffPhone && s.vendorId === activeVendor.id);
    if (existingIdx !== -1) {
      local[existingIdx] = createdStaff;
    } else {
      local.unshift(createdStaff);
    }
    saveLocalStaff(local);

    // 3. Register credentials so this staff member can log in via POS or Terminal immediately
    updateCredentialRegistry(staffPhone, staffPin, activeVendor, staffFullName);

    return NextResponse.json({
      success: true,
      message: `${staffFullName} added successfully as ${staffRole}.`,
      staff: createdStaff,
    });
  } catch (error: any) {
    console.error("[STAFF_POST_ERROR]:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE: Deactivate staff member
export async function DELETE(req: NextRequest) {
  try {
    const activeVendor: any = await getActiveVendor(req);
    if (!activeVendor) {
      return NextResponse.json({ success: false, message: "Vendor not found." }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get("id");

    if (!staffId) {
      return NextResponse.json({ success: false, message: "Staff ID required." }, { status: 400 });
    }

    try {
      await db.execute(sql`
        UPDATE vendor_staff
        SET is_active = false
        WHERE id = ${staffId} AND vendor_id = ${activeVendor.id};
      `);
    } catch (e: any) {
      console.warn("[STAFF_DELETE] DB error:", e.message);
    }

    const local = loadLocalStaff();
    const updated = local.filter((s) => s.id !== staffId);
    saveLocalStaff(updated);

    return NextResponse.json({ success: true, message: "Staff member deactivated." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PUT/PATCH: Support direct KYC updates through main staff route
export async function PUT(req: NextRequest) {
  const activeVendor: any = await getActiveVendor(req);
  if (!activeVendor) {
    return NextResponse.json({ success: false, message: "Vendor not found." }, { status: 404 });
  }
  const body = await req.json();
  const staffId = body.staffId || body.id;
  if (!staffId) {
    return NextResponse.json({ success: false, message: "Staff ID required." }, { status: 400 });
  }

  const local = loadLocalStaff();
  const idx = local.findIndex((s) => s.id === staffId);
  if (idx !== -1) {
    local[idx] = {
      ...local[idx],
      ...body,
      updatedAt: new Date().toISOString(),
    };
    saveLocalStaff(local);
    return NextResponse.json({ success: true, message: "Staff updated.", staff: local[idx] });
  }
  return NextResponse.json({ success: true, message: "Staff updated." });
}

export async function PATCH(req: NextRequest) {
  return PUT(req);
}
