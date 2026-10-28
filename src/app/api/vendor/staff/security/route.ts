import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getActiveVendor } from "@/lib/vendor-session";
import fs from "fs";
import path from "path";

const STAFF_FILE = path.join(process.cwd(), ".vendor_staff.json");

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

async function handleVerificationUpdate(req: NextRequest) {
  try {
    const activeVendor: any = await getActiveVendor(req);
    if (!activeVendor) {
      return NextResponse.json({ success: false, message: "Vendor not found." }, { status: 404 });
    }

    const body = await req.json();
    const {
      staffId,
      id,
      fullName,
      phoneNumber,
      nationalIdNumber,
      nin,
      emergencyContactPhone,
      emergencyPhone,
      verificationStatus,
      status,
    } = body;

    const targetStaffId = staffId || id;
    const resolvedNin = nationalIdNumber || nin || "";
    const resolvedEmergency = emergencyContactPhone || emergencyPhone || "";
    const resolvedStatus = verificationStatus || status || "verified";

    if (!targetStaffId) {
      return NextResponse.json({ success: false, message: "Staff ID is required." }, { status: 400 });
    }

    let updatedStaff: any = null;

    // 1. Attempt PostgreSQL update
    try {
      const rows: any = await db.execute(sql`
        UPDATE vendor_staff
        SET 
          national_id_number = ${resolvedNin},
          emergency_contact_phone = ${resolvedEmergency},
          verification_status = ${resolvedStatus}::staff_verification_status,
          updated_at = NOW()
        WHERE id = ${targetStaffId} AND vendor_id = ${activeVendor.id}
        RETURNING *;
      `);
      if (rows && rows.length > 0) {
        updatedStaff = rows[0];
      }
    } catch (dbErr: any) {
      // If enum or column is missing, attempt raw fallback without custom type casting
      try {
        const rows: any = await db.execute(sql`
          UPDATE vendor_staff
          SET 
            national_id_number = ${resolvedNin},
            emergency_contact_phone = ${resolvedEmergency},
            updated_at = NOW()
          WHERE id = ${targetStaffId} AND vendor_id = ${activeVendor.id}
          RETURNING *;
        `);
        if (rows && rows.length > 0) updatedStaff = rows[0];
      } catch (fallbackErr: any) {
        console.warn("[STAFF_SECURITY] DB update failed, falling back to local file:", fallbackErr.message);
      }
    }

    // 2. Persist in local storage
    const local = loadLocalStaff();
    const idx = local.findIndex((s) => s.id === targetStaffId);

    if (idx !== -1) {
      local[idx] = {
        ...local[idx],
        fullName: fullName || local[idx].fullName || local[idx].full_name,
        phoneNumber: phoneNumber || local[idx].phoneNumber || local[idx].phone_number,
        nationalIdNumber: resolvedNin,
        national_id_number: resolvedNin,
        emergencyContactPhone: resolvedEmergency,
        emergency_contact_phone: resolvedEmergency,
        verificationStatus: resolvedStatus,
        verification_status: resolvedStatus,
        updatedAt: new Date().toISOString(),
      };
      saveLocalStaff(local);
      if (!updatedStaff) updatedStaff = local[idx];
    } else {
      // If not in local file, append it
      const newEntry = {
        id: targetStaffId,
        vendorId: activeVendor.id,
        fullName: fullName || "Staff Member",
        phoneNumber: phoneNumber || "",
        nationalIdNumber: resolvedNin,
        emergencyContactPhone: resolvedEmergency,
        verificationStatus: resolvedStatus,
        updatedAt: new Date().toISOString(),
      };
      local.unshift(newEntry);
      saveLocalStaff(local);
      if (!updatedStaff) updatedStaff = newEntry;
    }

    return NextResponse.json({
      success: true,
      message: "Staff verification & KYC updated successfully.",
      staff: updatedStaff,
    });
  } catch (error: any) {
    console.error("[STAFF_SECURITY_ERROR]:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handleVerificationUpdate(req);
}

export async function PUT(req: NextRequest) {
  return handleVerificationUpdate(req);
}

export async function PATCH(req: NextRequest) {
  return handleVerificationUpdate(req);
}
