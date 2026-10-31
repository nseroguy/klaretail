import { processSNPLSplitSettlement } from "@/services/settlementSplitter";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { orders, orderItems, vendorTables, tableSessions, vendors } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, paymentMethod, cashTendered, customerPhone, cashierId, posTerminalId, tableNumber } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: "Cart cannot be empty." }, { status: 400 });
    }

    const subtotal = items.reduce((sum: number, it: any) => {
      const p = it.unitPrice ?? it.price ?? it.priceCents ?? 0;
      const q = it.quantity ?? it.qty ?? 1;
      return sum + (Number(p) * Number(q));
    }, 0);

    // safeCashierId resolved from session below

    
    // Resolve true database vendor ID strictly from PostgreSQL by slug or verified ID
    let session: any = null;
    const sessionCookie = req.cookies.get("staff_session")?.value || req.cookies.get("session_token")?.value;
    if (sessionCookie) {
      try { session = JSON.parse(sessionCookie); } catch {}
    }

    const targetSlug = body.vendorSlug || session?.vendorSlug || "bourbon-pizza-wandegeya";
    const dbVendor = await db.query.vendors.findFirst({
      where: sql`${vendors.slug} = ${targetSlug}`,
    });

    const vendorId = dbVendor?.id || "27262e73-3bf4-4baa-a837-1f4c9e638f5d";

    // Validate cashierId against users table to prevent FK violation
    let validatedCashierId: string | null = null;
    const candidateCashierId = session?.userId || cashierId;
    if (candidateCashierId && String(candidateCashierId).length > 20) {
      try {
        const userExists = await db.execute(sql`SELECT id FROM users WHERE id = ${candidateCashierId} LIMIT 1;`);
        if ((userExists as any)?.length > 0) {
          validatedCashierId = candidateCashierId;
        }
      } catch {}
    }

    const safeCashierId = (session?.userId && String(session.userId).length > 10) 
      ? session.userId 
      : ((cashierId && String(cashierId).trim().length > 10) ? cashierId : null);



    if (!vendorId) {
      return NextResponse.json({ success: false, message: "No active vendor found." }, { status: 400 });
    }

    // Resolve optional table association
    let tableRecord: any = null;
    let sessionId: string | null = null;

    if (tableNumber) {
      tableRecord = await db.query.vendorTables.findFirst({
        where: sql`${vendorTables.vendorId} = ${vendorId} AND UPPER(${vendorTables.tableNumber}) = UPPER(${tableNumber})`,
      });

      if (tableRecord) {
        // Resolve or create table session
        let existingSession = await db.query.tableSessions.findFirst({
          where: sql`${tableSessions.tableId} = ${tableRecord.id} AND ${tableSessions.status} = 'open'`,
        });

        if (!existingSession) {
          const [newSession] = await db
            .insert(tableSessions)
            .values({
              vendorId,
              tableId: tableRecord.id,
              status: "open",
              guestCount: 2,
              openedAt: new Date(),
            } as any)
            .returning();
          existingSession = newSession;
        }
        sessionId = existingSession?.id || null;
      }
    }

    // Determine if kitchen preparation is required
    const requiresKitchenPrep = Boolean(tableNumber) || items.some((item: any) => {
      const name = (item.name || "").toLowerCase();
      const sku = (item.sku || "").toUpperCase();
      const hotKeywords = ["pizza", "wing", "bread", "crust", "burger", "wrap", "chips", "fries"];
      const isHotFood = hotKeywords.some((keyword) => name.includes(keyword)) || sku.startsWith("PIZ") || sku.startsWith("SID");
      const hasModifiers = Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0;
      return isHotFood || hasModifiers || Boolean(item.kitchenNotes);
    });

    const fulfillmentType = tableNumber ? "dine_in" : "walk_in";
    const initialStatus = requiresKitchenPrep ? "accepted" : "delivered";
    const prefix = tableNumber ? `TAB-${tableNumber}` : "POS";
    const generatedOrderNumber = `${prefix}-${Date.now().toString().slice(-4)}`;

    const result = await db.transaction(async (tx) => {
      const [newOrder] = await tx
        .insert(orders)
        .values({
          orderNumber: generatedOrderNumber,
          vendorId,
          tableId: tableRecord?.id || null,
          tableSessionId: sessionId,
          cashierId: validatedCashierId,
          posTerminalId: posTerminalId || "POS-TERM-01",
          fulfillmentType,
          status: initialStatus,
          productSubtotal: subtotal,
          deliveryFee: 0,
          serviceFee: 0,
          damageProtectionFee: 0,
          convenienceFee: 0,
          totalAmount: subtotal,
          paymentMethod: paymentMethod || "COD",
          codAmountDue: paymentMethod === "COD" ? subtotal : 0,
          codCashReceived: paymentMethod === "COD" ? Number(cashTendered || subtotal) : 0,
          codVerifiedAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .returning();

      for (const item of items) {
        await tx.insert(orderItems).values({
          orderId: newOrder.id,
          productId: String(item.productId || `ITEM-${Date.now()}`),
          name: item.name,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice ?? item.price ?? item.priceCents ?? 0),
          totalPrice: Number(item.unitPrice ?? item.price ?? item.priceCents ?? 0) * (Number(item.quantity ?? item.qty) || 1),
          selectedModifiers: item.selectedModifiers || [],
          kitchenNotes: item.kitchenNotes || null,
        } as any);
      }

      return newOrder;
    });


    
    // Synchronize cash sales to shift ledger
    try {
      const shiftFile = path.join(process.cwd(), ".shifts_ledger.json");
      if (fs.existsSync(shiftFile)) {
        const shifts = JSON.parse(fs.readFileSync(shiftFile, "utf-8"));
        const idx = shifts.findIndex((s: any) => (s.vendorId === vendorId || s.vendorId === "bourbon-pizza-wandegeya") && s.status === "open");
        if (idx !== -1) {
          shifts[idx].totalGross = (shifts[idx].totalGross || 0) + subtotal;
          if (String(paymentMethod).toLowerCase() === "cash" || paymentMethod === "COD") {
            shifts[idx].expectedCash = (shifts[idx].expectedCash || shifts[idx].openingFloat) + subtotal;
          }
          fs.writeFileSync(shiftFile, JSON.stringify(shifts, null, 2), "utf-8");
        }
      }
    } catch (e) {
      console.warn("[CHECKOUT_SHIFT_SYNC] Error:", e);
    }

    
    // Accumulate cash sale directly into active shift in PostgreSQL
    if (String(paymentMethod).toLowerCase() === "cash" || paymentMethod === "COD") {
      try {
        await db.execute(sql`
          UPDATE pos_shifts
          SET cash_sales = COALESCE(cash_sales, 0) + ${subtotal},
              total_sales = COALESCE(total_sales, 0) + ${subtotal},
              expected_cash = COALESCE(expected_cash, opening_float) + ${subtotal},
              updated_at = NOW()
          WHERE (vendor_id = ${vendorId} OR vendor_id IN (SELECT id FROM vendors WHERE slug = 'bourbon-pizza-wandegeya'))
            AND status = 'open';
        `);
      } catch (err) {
        console.warn("[CHECKOUT_SHIFT_DB_UPDATE] Error:", err);
      }
    }

    
    // Live POS Shift Reconciliation: Accumulate cash checkout into active shift
    if (String(paymentMethod).toLowerCase() === "cash" || paymentMethod === "COD") {
      const saleAmount = Number(subtotal || 0);

      // A. Update PostgreSQL active shift
      try {
        await db.execute(sql`
          UPDATE pos_shifts
          SET cash_sales = COALESCE(cash_sales, 0) + ${saleAmount},
              total_sales = COALESCE(total_sales, 0) + ${saleAmount},
              expected_cash = COALESCE(expected_cash, opening_float) + ${saleAmount},
              updated_at = NOW()
          WHERE (vendor_id = ${vendorId} OR vendor_id IN (SELECT id FROM vendors WHERE slug = 'bourbon-pizza-wandegeya'))
            AND status = 'open';
        `);
      } catch (dbErr: any) {
        console.warn("[CHECKOUT_SHIFT_DB_UPDATE] DB notice:", dbErr?.message);
      }

      // B. Update local shift registry (.pos_shifts.json)
      try {
        const shiftsFile = path.join(process.cwd(), ".pos_shifts.json");
        if (fs.existsSync(shiftsFile)) {
          const shifts = JSON.parse(fs.readFileSync(shiftsFile, "utf-8"));
          let updated = false;
          for (const s of shifts) {
            const isMatch = (s.vendorId === vendorId || s.vendor_id === vendorId || s.vendorSlug === "bourbon-pizza-wandegeya");
            if (isMatch && s.status === "open") {
              const curCash = Number(s.cashSales ?? s.cash_sales ?? 0);
              const curTotal = Number(s.totalSales ?? s.total_sales ?? 0);
              const curFloat = Number(s.openingFloat ?? s.opening_float ?? 0);
              const curExpected = Number(s.expectedCash ?? s.expected_cash ?? curFloat);

              s.cashSales = curCash + saleAmount;
              s.cash_sales = curCash + saleAmount;
              s.totalSales = curTotal + saleAmount;
              s.total_sales = curTotal + saleAmount;
              s.expectedCash = curExpected + saleAmount;
              s.expected_cash = curExpected + saleAmount;
              s.updatedAt = new Date().toISOString();
              s.updated_at = new Date().toISOString();
              updated = true;
            }
          }
          if (updated) {
            fs.writeFileSync(shiftsFile, JSON.stringify(shifts, null, 2), "utf-8");
          }
        }
      } catch (fileErr: any) {
        console.warn("[CHECKOUT_SHIFT_FILE_UPDATE] File notice:", fileErr?.message);
      }
    }

    // 20% Automated SNPL Repayment Sweep for Active Credit Tranches
    let snplSettlement: any = null;
    try {
      snplSettlement = await processSNPLSplitSettlement(
        vendorId,
        subtotal,
        result.id
      );
    } catch (snplErr: any) {
      console.warn("[SNPL_SWEEP] Non-blocking repayment sweep notice:", snplErr?.message);
    }

    return NextResponse.json({ 
      success: true, 
      order: result, 
      sentToKitchen: requiresKitchenPrep,
      fulfillmentType,
      snplSettlement
    });
  } catch (error: any) {
    console.error("[POS_CHECKOUT_ERROR]:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process transaction." },
      { status: 500 }
    );
  }
}
