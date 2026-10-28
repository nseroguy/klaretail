import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getActiveVendor, parseVendorSession } from "@/lib/vendor-session";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const SHIFTS_FILE = path.join(process.cwd(), ".pos_shifts.json");

function isValidUUID(id: any): boolean {
  if (typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function loadLocalShifts(): any[] {
  try {
    if (fs.existsSync(SHIFTS_FILE)) {
      return JSON.parse(fs.readFileSync(SHIFTS_FILE, "utf-8"));
    }
  } catch {}
  return [];
}

function saveLocalShifts(shifts: any[]) {
  try {
    fs.writeFileSync(SHIFTS_FILE, JSON.stringify(shifts, null, 2), "utf-8");
  } catch {}
}

function matchesVendor(shift: any, vendor: any): boolean {
  if (!shift || !vendor) return false;
  const sVendorId = shift.vendorId || shift.vendor_id;
  const sSlug = shift.vendorSlug || shift.vendor_slug;
  if (sVendorId && vendor.id && sVendorId === vendor.id) return true;
  if (sSlug && vendor.slug && sSlug === vendor.slug) return true;
  if (vendor.slug === "bourbon-pizza-wandegeya" && (shift.cashierName?.includes("Bourbon") || shift.cashier_name?.includes("Bourbon"))) return true;
  return false;
}

export async function GET(req: NextRequest) {
  try {
    const activeVendor: any = await getActiveVendor(req);
    if (!activeVendor) {
      return NextResponse.json({ success: false, message: "Active vendor not found." }, { status: 404 });
    }

    let activeShift = null;

    if (isValidUUID(activeVendor.id)) {
      try {
        const rows: any = await db.execute(sql`
          SELECT * FROM pos_shifts 
          WHERE vendor_id = ${activeVendor.id} AND status = 'open' 
          ORDER BY opened_at DESC 
          LIMIT 1;
        `);
        if (rows && rows.length > 0) {
          activeShift = rows[0];
        }
      } catch (e: any) {
        console.warn("[POS_SHIFT_GET] DB query failed, falling back to local:", e.message);
      }
    }

    if (!activeShift) {
      const local = loadLocalShifts();
      activeShift = local.find((s) => matchesVendor(s, activeVendor) && s.status === "open") || null;
    }

    
    let pastShifts: any[] = [];
    if (isValidUUID(activeVendor.id)) {
      try {
        const pastRows: any = await db.execute(sql`
          SELECT * FROM pos_shifts
          WHERE vendor_id = ${activeVendor.id} AND status = 'closed'
          ORDER BY closed_at DESC
          LIMIT 20;
        `);
        pastShifts = pastRows || [];
      } catch (e) {}
    }

    const local = loadLocalShifts();
    const pastFromLocal = local.filter((s: any) => matchesVendor(s, activeVendor) && s.status === "closed");
    
    return NextResponse.json({
      success: true,
      vendor: {
        id: activeVendor.id,
        name: activeVendor.name,
        slug: activeVendor.slug,
      },
      activeShift: activeShift ? {
        id: activeShift.id,
        cashierName: activeShift.cashier_name || activeShift.cashierName,
        openingFloat: Number(activeShift.opening_float || activeShift.openingFloat || 0),
        totalGross: Number(activeShift.total_sales || activeShift.totalSales || 0),
        expectedCash: Number(activeShift.expected_cash || activeShift.expectedCash || activeShift.opening_float || 0),
        status: activeShift.status,
        openedAt: activeShift.opened_at || activeShift.openedAt,
      } : null,
      pastShifts: (pastShifts?.length > 0 ? pastShifts : pastFromLocal).map((s: any) => ({
        id: s.id,
        cashierName: s.cashier_name || s.cashierName,
        openingFloat: Number(s.opening_float || s.openingFloat || 0),
        totalGross: Number(s.total_sales || s.totalSales || 0),
        expectedCash: Number(s.expected_cash || s.expectedCash || 0),
        actualCounted: Number(s.actual_cash_counted || s.actualCashCounted || 0),
        variance: Number(s.cash_difference || s.discrepancy || 0),
        zReportNumber: s.z_report_number || s.zReportNumber || "Z-" + String(s.id).slice(0, 8).toUpperCase(),
        openedAt: s.opened_at || s.openedAt,
        closedAt: s.closed_at || s.closedAt,
        status: s.status,
      })),
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const activeVendor: any = await getActiveVendor(req);
    if (!activeVendor) {
      return NextResponse.json({ success: false, message: "Active vendor not found." }, { status: 404 });
    }

    const session = parseVendorSession(req);
    const body = await req.json();
    const {
      action,
      openingFloat,
      cashierName,
      shiftId,
      notes,
      reason,
      amount,
      actualCashCount,
      actualCounted,
      actualCashCounted,
    } = body;

    const targetVendorId = isValidUUID(activeVendor.id) ? activeVendor.id : crypto.randomUUID();
    const targetCashierId = isValidUUID(session?.userId) ? session?.userId : null;
    const targetCashierName = cashierName || session?.vendorName || "Cashier";

    // -------------------------------------------------------------
    // 1. OPEN SHIFT
    // -------------------------------------------------------------
    if (action === "open_shift") {
      const floatAmount = Math.max(0, parseInt(openingFloat || 0, 10));
      let createdShift: any = null;

      try {
        const rows: any = await db.execute(sql`
          INSERT INTO pos_shifts (
            vendor_id, 
            cashier_id, 
            cashier_name, 
            opening_float, 
            expected_cash, 
            status
          ) VALUES (
            ${targetVendorId}, 
            ${targetCashierId}, 
            ${targetCashierName}, 
            ${floatAmount}, 
            ${floatAmount}, 
            'open'
          ) RETURNING *;
        `);
        if (rows && rows.length > 0) {
          createdShift = rows[0];
        }
      } catch (dbErr: any) {
        console.warn("[POS_SHIFT] DB insert fallback to local:", dbErr.message);
      }

      if (!createdShift) {
        createdShift = {
          id: crypto.randomUUID(),
          vendorId: targetVendorId,
          vendor_id: targetVendorId,
          vendorSlug: activeVendor.slug,
          cashierId: targetCashierId,
          cashier_id: targetCashierId,
          cashierName: targetCashierName,
          cashier_name: targetCashierName,
          openingFloat: floatAmount,
          opening_float: floatAmount,
          expectedCash: floatAmount,
          expected_cash: floatAmount,
          cashSales: 0,
          cash_sales: 0,
          momoSales: 0,
          momo_sales: 0,
          cardSales: 0,
          card_sales: 0,
          totalSales: 0,
          total_sales: 0,
          paidOut: 0,
          paid_out: 0,
          status: "open",
          openedAt: new Date().toISOString(),
          opened_at: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      const local = loadLocalShifts();
      // Close any previously hanging open shifts for this vendor locally
      for (const s of local) {
        if (matchesVendor(s, activeVendor) && s.status === "open") {
          s.status = "closed";
        }
      }
      local.unshift(createdShift);
      saveLocalShifts(local);

      return NextResponse.json({
        success: true,
        message: "Shift opened successfully.",
        shift: createdShift,
      });
    }

    // -------------------------------------------------------------
    // 2. PAID OUT (PETTY CASH)
    // -------------------------------------------------------------
    if (action === "paid_out") {
      const payoutAmount = Math.max(0, parseInt(amount || 0, 10));
      if (payoutAmount <= 0) {
        return NextResponse.json({ success: false, message: "Valid payout amount required." }, { status: 400 });
      }

      const local = loadLocalShifts();
      const currentShiftIdx = local.findIndex(
        (s) => matchesVendor(s, activeVendor) && s.status === "open"
      );

      if (currentShiftIdx === -1) {
        return NextResponse.json({ success: false, message: "No active shift open for this store." }, { status: 404 });
      }

      const shift = local[currentShiftIdx];
      const targetId = shift.id;

      let updatedShift: any = null;
      if (isValidUUID(targetId)) {
        try {
          const rows: any = await db.execute(sql`
            UPDATE pos_shifts 
            SET 
              paid_out = COALESCE(paid_out, 0) + ${payoutAmount},
              expected_cash = COALESCE(expected_cash, opening_float) - ${payoutAmount},
              notes = CONCAT(COALESCE(notes, ''), ' | Paid Out: ', ${payoutAmount}::text, ' UGX (', ${reason || 'Petty cash'}::text, ')'),
              updated_at = NOW()
            WHERE id = ${targetId}
            RETURNING *;
          `);
          if (rows && rows.length > 0) {
            updatedShift = rows[0];
          }
        } catch (e: any) {
          console.warn("[POS_SHIFT] DB update fallback to local:", e.message);
        }
      }

      const prevPaid = shift.paid_out ?? shift.paidOut ?? 0;
      const prevExpected = shift.expected_cash ?? shift.expectedCash ?? shift.opening_float ?? shift.openingFloat ?? 0;
      const newPaid = prevPaid + payoutAmount;
      const newExpected = prevExpected - payoutAmount;
      const newNotes = (shift.notes ? shift.notes + " | " : "") + `Paid Out: ${payoutAmount} UGX (${reason || "Petty cash"})`;

      local[currentShiftIdx] = {
        ...shift,
        paid_out: newPaid,
        paidOut: newPaid,
        expected_cash: newExpected,
        expectedCash: newExpected,
        notes: newNotes,
        updated_at: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveLocalShifts(local);

      return NextResponse.json({
        success: true,
        message: `UGX ${payoutAmount.toLocaleString()} paid out from drawer.`,
        shift: updatedShift || local[currentShiftIdx],
      });
    }

    // -------------------------------------------------------------
    // 3. CLOSE SHIFT (Z-REPORT)
    // -------------------------------------------------------------
    if (action === "close_shift") {
      const countedCash = parseInt(actualCounted ?? actualCashCount ?? actualCashCounted ?? 0, 10);
      const local = loadLocalShifts();
      const currentShiftIdx = local.findIndex(
        (s) => matchesVendor(s, activeVendor) && s.status === "open"
      );

      if (currentShiftIdx === -1) {
        return NextResponse.json({ success: false, message: "No active shift open to close." }, { status: 404 });
      }

      const shift = local[currentShiftIdx];
      const targetId = shift.id;
      const expectedCash = shift.expected_cash ?? shift.expectedCash ?? shift.opening_float ?? shift.openingFloat ?? 0;
      const discrepancy = countedCash - expectedCash;

      let closedShift: any = null;
      if (isValidUUID(targetId)) {
        try {
          const rows: any = await db.execute(sql`
            UPDATE pos_shifts 
            SET 
              closed_at = NOW(),
              actual_cash_counted = ${countedCash},
              cash_difference = ${discrepancy},
              status = 'closed',
              notes = CONCAT(COALESCE(notes, ''), ' | Close Notes: ', ${notes || 'Balanced'}::text),
              updated_at = NOW()
            WHERE id = ${targetId}
            RETURNING *;
          `);
          if (rows && rows.length > 0) {
            closedShift = rows[0];
          }
        } catch (e: any) {
          console.warn("[POS_SHIFT] DB close fallback to local:", e.message);
        }
      }

      local[currentShiftIdx] = {
        ...shift,
        closed_at: new Date().toISOString(),
        closedAt: new Date().toISOString(),
        actual_cash_counted: countedCash,
        actualCashCounted: countedCash,
        cash_difference: discrepancy,
        discrepancy,
        status: "closed",
        notes: (shift.notes ? shift.notes + " | " : "") + (notes || "Balanced"),
        updated_at: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveLocalShifts(local);

      return NextResponse.json({
        success: true,
        message: "Shift closed and Z-Report finalized.",
        shift: closedShift || local[currentShiftIdx],
      });
    }

    return NextResponse.json({ success: false, message: "Unknown action." }, { status: 400 });
  } catch (error: any) {
    console.error("[POS_SHIFT_POST_ERROR]:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
