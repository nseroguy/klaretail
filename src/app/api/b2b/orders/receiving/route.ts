import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, orderId, pin, receivingItems, emptyCratesReturned } = body;

    if (!orderId || !pin) {
      return NextResponse.json(
        { success: false, message: 'Order ID and verification PIN are required.' },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------------
    // LEG 1: SUPPLIER DOCK RELEASE (PIN HANDSHAKE)
    // -------------------------------------------------------------------------
    if (action === 'SUPPLIER_DOCK_PICKUP') {
      const orderQuery: any = await db.execute(sql`
        SELECT id, order_number, status, supplier_pickup_pin, crates_expected, rti_delivered_count
        FROM b2b_purchase_orders
        WHERE id::text = ${orderId} OR order_number = ${orderId}
        LIMIT 1;
      `);
      const po = orderQuery.rows?.[0] || orderQuery[0];

      if (!po) {
        return NextResponse.json({ success: false, message: 'Purchase Order not found.' }, { status: 404 });
      }

      if (String(po.supplier_pickup_pin).trim() !== String(pin).trim()) {
        return NextResponse.json({ success: false, message: 'Invalid Supplier Dock Release PIN.' }, { status: 401 });
      }

      const confirmedRti = Number(po.rti_delivered_count || po.crates_expected || 0);

      await db.execute(sql`
        UPDATE b2b_purchase_orders
        SET status = 'IN_TRANSIT',
            crates_delivered = ${confirmedRti},
            rti_delivered_count = ${confirmedRti},
            updated_at = NOW()
        WHERE id = ${po.id}::uuid;
      `);

      return NextResponse.json({
        success: true,
        message: `Order ${po.order_number} released from supplier dock. Status set to IN_TRANSIT.`,
        orderNumber: po.order_number,
        status: 'IN_TRANSIT',
      });
    }

    // -------------------------------------------------------------------------
    // LEG 2: RETAIL STORE RECEIVING & MULTI-VESSEL RECONCILIATION
    // -------------------------------------------------------------------------
    if (action === 'RETAIL_STORE_RECEIVING') {
      const orderQuery: any = await db.execute(sql`
        SELECT 
          id, order_number, status, handover_pin, total_amount, 
          subtotal, crates_delivered, rti_delivered_count, non_returnable_packages_count,
          crate_deposit_unit_price, delivery_fee, rider_freight_payout
        FROM b2b_purchase_orders
        WHERE id::text = ${orderId} OR order_number = ${orderId}
        LIMIT 1;
      `);
      const po = orderQuery.rows?.[0] || orderQuery[0];

      if (!po) {
        return NextResponse.json({ success: false, message: 'Purchase Order not found.' }, { status: 404 });
      }

      if (String(po.handover_pin).trim() !== String(pin).trim()) {
        return NextResponse.json({ success: false, message: 'Invalid Retailer Delivery PIN.' }, { status: 401 });
      }

      let totalCreditNoteDeduction = 0;

      // 1. Line item delivery reconciliation
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
              WHERE id = ${item.itemId}::uuid;
            `);
          } else {
            await db.execute(sql`
              UPDATE b2b_purchase_order_items
              SET quantity_delivered = ${qtyDelivered},
                  final_payable_subtotal = ${qtyDelivered * unitPrice}
              WHERE id = ${item.itemId}::uuid;
            `);
          }
        }
      }

      // 2. Base Goods Reconciliation (Catalog price has 1% embedded listing markup)
      const visibleGoodsTotal = Math.max(0, Number(po.total_amount || po.subtotal || 0) - totalCreditNoteDeduction);
      const rawWholesalerBase = Math.round(visibleGoodsTotal / 1.01);
      const listingMarkupAmount = visibleGoodsTotal - rawWholesalerBase;

      // 3. Wholesaler Fast Settlement (2% early discount for T+1 guaranteed payout)
      const wholesalerDiscountAmount = Math.round(rawWholesalerBase * 0.02);
      const netWholesalerPayout = rawWholesalerBase - wholesalerDiscountAmount;

      // 4. Returnable Transport Items (RTI) vs Consumables Packaging
      const rtiDelivered = Number(po.rti_delivered_count || po.crates_delivered || 0);
      const rtiReturned = Number(emptyCratesReturned || 0);
      const unitDeposit = Number(po.crate_deposit_unit_price || 10000);

      const unreturnedRti = Math.max(0, rtiDelivered - rtiReturned);
      const rtiDepositHeld = unreturnedRti * unitDeposit;

      // Handling Fees: UGX 500 per returnable crate, plus any consumable package handling
      const nonReturnableCount = Number(po.non_returnable_packages_count || 0);
      const rtiHandlingFee = rtiDelivered * 500;
      const nonReturnableHandlingFee = nonReturnableCount * 300;
      const totalCargoHandlingFee = rtiHandlingFee + nonReturnableHandlingFee;

      // 5. Retailer Credit Terms (1.5% SNPL Facility Fee + 1% Service Fee)
      const snplFacilityAmount = Math.round(visibleGoodsTotal * 0.015);
      const storeSubtotalBeforeServiceFee = visibleGoodsTotal + snplFacilityAmount + totalCargoHandlingFee;
      const retailerServiceFeeAmount = Math.round(storeSubtotalBeforeServiceFee * 0.01);

      // Final payable principal by store on Day 14
      const finalPayableSNPLPrincipal = storeSubtotalBeforeServiceFee + retailerServiceFeeAmount + rtiDepositHeld;

      // 6. Logistics Freight Margin (20% margin spread)
      const grossDeliveryFee = Number(po.delivery_fee || 0);
      const riderFreightPayout = Number(po.rider_freight_payout || Math.round(grossDeliveryFee * 0.80));
      const platformDeliveryMargin = Math.max(0, grossDeliveryFee - riderFreightPayout);

      // 7. Consolidated KlaRetail Platform Net Profit
      const platformNetProfit = 
        wholesalerDiscountAmount +   // 2% from wholesaler
        listingMarkupAmount +        // 1% catalog price uplift
        snplFacilityAmount +         // 1.5% SNPL facility fee
        totalCargoHandlingFee +      // Multi-vessel handling fees
        platformDeliveryMargin +     // 20% logistics spread
        retailerServiceFeeAmount;    // 1% store service fee

      // 8. Commit settlement to database
      await db.execute(sql`
        UPDATE b2b_purchase_orders
        SET status = 'DELIVERED_AND_RECEIVED',
            crates_delivered = ${rtiDelivered},
            crates_returned_empty = ${rtiReturned},
            rti_delivered_count = ${rtiDelivered},
            rti_returned_count = ${rtiReturned},
            crate_deposit_held = ${rtiDepositHeld},
            crate_handling_fee = ${totalCargoHandlingFee},
            cargo_handling_fee = ${totalCargoHandlingFee},
            credit_note_deduction = ${totalCreditNoteDeduction},
            catalog_markup_amount = ${listingMarkupAmount},
            wholesaler_discount_bps = 200,
            wholesaler_discount_amount = ${wholesalerDiscountAmount},
            net_wholesaler_payout = ${netWholesalerPayout},
            snpl_facility_bps = 150,
            snpl_facility_amount = ${snplFacilityAmount},
            retailer_service_fee_bps = 100,
            retailer_service_fee_amount = ${retailerServiceFeeAmount},
            rider_freight_payout = ${riderFreightPayout},
            platform_delivery_margin = ${platformDeliveryMargin},
            snpl_adjusted_principal = ${finalPayableSNPLPrincipal},
            platform_net_profit = ${platformNetProfit},
            updated_at = NOW()
        WHERE id = ${po.id}::uuid;
      `);

      return NextResponse.json({
        success: true,
        message: `Order ${po.order_number} successfully received and reconciled.`,
        financialSummary: {
          visibleGoodsTotal,
          rawWholesalerBase,
          netWholesalerPayout,
          packagingReconciliation: {
            rtiDelivered,
            rtiReturned,
            unreturnedRti,
            rtiDepositHeld,
            nonReturnablePackages: nonReturnableCount,
            totalCargoHandlingFee,
          },
          storePayable: {
            stockPrincipal: visibleGoodsTotal,
            snplFacilityFee: snplFacilityAmount,
            cargoHandlingFee: totalCargoHandlingFee,
            retailerServiceFee: retailerServiceFeeAmount,
            unreturnedRtiDeposit: rtiDepositHeld,
            totalDueDay14: finalPayableSNPLPrincipal,
          },
          platformEarnings: {
            wholesalerSettlementCut: wholesalerDiscountAmount,
            catalogMarkupBuffer: listingMarkupAmount,
            snplFacilityFee: snplFacilityAmount,
            cargoHandlingFee: totalCargoHandlingFee,
            freightMargin: platformDeliveryMargin,
            retailerServiceFee: retailerServiceFeeAmount,
            netPlatformProfit: platformNetProfit,
          },
        },
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid action provided.' }, { status: 400 });
  } catch (error: any) {
    console.error('[RECEIVING ERROR]:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
