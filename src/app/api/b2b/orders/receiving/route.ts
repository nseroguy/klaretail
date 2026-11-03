import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, orderId, pin, riderId, receivingItems, emptyCratesReturned } = body;

    if (!orderId || !action) {
      return NextResponse.json({ success: false, message: 'orderId and action are required.' }, { status: 400 });
    }

    // -------------------------------------------------------------------------
    // LEG 1: DOCKSIDE SUPPLIER PICKUP HANDSHAKE
    // -------------------------------------------------------------------------
    if (action === 'SUPPLIER_DOCK_PICKUP') {
      const orderQuery: any = await db.execute(sql`
        SELECT id, order_number, status, supplier_pickup_pin, assigned_rider_id
        FROM b2b_purchase_orders
        WHERE id::text = ${orderId} OR order_number = ${orderId}
        LIMIT 1
      `);
      const po = orderQuery.rows?.[0] || orderQuery[0];

      if (!po) {
        return NextResponse.json({ success: false, message: 'Purchase Order not found.' }, { status: 404 });
      }

      if (po.assigned_rider_id && riderId && String(po.assigned_rider_id) !== String(riderId)) {
        return NextResponse.json({ success: false, message: 'Rider identity does not match assigned courier.' }, { status: 403 });
      }

      if (po.supplier_pickup_pin && String(po.supplier_pickup_pin).trim() !== String(pin).trim()) {
        return NextResponse.json({ success: false, message: 'Invalid Supplier Dispatch PIN.' }, { status: 401 });
      }

      await db.execute(sql`
        UPDATE b2b_purchase_orders
        SET status = 'IN_TRANSIT',
            supplier_picked_up_at = NOW(),
            updated_at = NOW()
        WHERE id = ${po.id}::uuid
      `);

      return NextResponse.json({
        success: true,
        message: `Order ${po.order_number} verified and released from supplier dock. Status set to IN_TRANSIT.`,
        orderNumber: po.order_number,
        status: 'IN_TRANSIT'
      });
    }

    // -------------------------------------------------------------------------
    // LEG 2: STORE RECEIVING, PARTIAL CLAIMS & EMPTY CRATE HANDSHAKE
    // -------------------------------------------------------------------------
    if (action === 'RETAIL_STORE_RECEIVING') {
      const orderQuery: any = await db.execute(sql`
        SELECT 
          id, order_number, status, handover_pin, total_amount, 
          subtotal, crates_delivered, crate_deposit_unit_price
        FROM b2b_purchase_orders
        WHERE id::text = ${orderId} OR order_number = ${orderId}
        LIMIT 1
      `);
      const po = orderQuery.rows?.[0] || orderQuery[0];

      if (!po) {
        return NextResponse.json({ success: false, message: 'Purchase Order not found.' }, { status: 404 });
      }

      if (String(po.handover_pin).trim() !== String(pin).trim()) {
        return NextResponse.json({ success: false, message: 'Invalid Retailer Delivery PIN.' }, { status: 401 });
      }

      let totalCreditNoteDeduction = 0;

      // Line item check-in (reconciling against quantity & unit_price)
      if (Array.isArray(receivingItems) && receivingItems.length > 0) {
        for (const item of receivingItems) {
          const qtyDelivered = Number(item.quantityDelivered);
          const qtyOrdered = Number(item.quantityOrdered);
          const unitPrice = Number(item.unitPrice);

          if (qtyDelivered < qtyOrdered) {
            const rejectedUnits = qtyOrdered - qtyDelivered;
            const itemDeduction = rejectedUnits * unitPrice;
            totalCreditNoteDeduction += itemDeduction;

            await db.execute(sql`
              UPDATE b2b_purchase_order_items
              SET quantity_delivered = ${qtyDelivered},
                  rejection_reason = ${item.rejectionReason || 'DAMAGED_OR_DEFECTIVE'},
                  final_payable_subtotal = ${qtyDelivered * unitPrice}
              WHERE id = ${item.itemId}::uuid
            `);
          } else {
            await db.execute(sql`
              UPDATE b2b_purchase_order_items
              SET quantity_delivered = ${qtyDelivered},
                  final_payable_subtotal = ${qtyDelivered * unitPrice}
              WHERE id = ${item.itemId}::uuid
            `);
          }
        }
      }

      // Empty Crate (RTI) Accounting
      const cratesDeliveredCount = Number(po.crates_delivered || 0);
      const cratesReturnedCount = Number(emptyCratesReturned || 0);
      const unitDeposit = Number(po.crate_deposit_unit_price || 10000);

      const unreturnedCrates = Math.max(0, cratesDeliveredCount - cratesReturnedCount);
      const crateDepositLiability = unreturnedCrates * unitDeposit;

      const originalTotal = Number(po.total_amount || 0);
      const adjustedTotal = Math.max(0, originalTotal - totalCreditNoteDeduction + crateDepositLiability);

      await db.execute(sql`
        UPDATE b2b_purchase_orders
        SET status = 'DELIVERED_AND_RECEIVED',
            crates_returned_empty = ${cratesReturnedCount},
            crate_deposit_held = ${crateDepositLiability},
            credit_note_deduction = ${totalCreditNoteDeduction},
            snpl_adjusted_principal = ${adjustedTotal},
            updated_at = NOW()
        WHERE id = ${po.id}::uuid
      `);

      return NextResponse.json({
        success: true,
        message: `Order ${po.order_number} successfully received.`,
        financialSummary: {
          originalPrincipal: originalTotal,
          creditNoteAdjustment: totalCreditNoteDeduction,
          unreturnedCrateDepositHeld: crateDepositLiability,
          finalPayableSNPLPrincipal: adjustedTotal,
        },
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid action provided.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
