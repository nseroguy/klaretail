import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Platform Financial Totals & Liquidity Segregation
    const platformTotalsResult: any = await db.execute(sql`
      SELECT 
        COUNT(*)::int AS total_orders,
        COUNT(*) FILTER (WHERE status::text = 'delivered')::int AS delivered_orders,
        COUNT(*) FILTER (WHERE status::text IN ('rider_assigned', 'dispatched'))::int AS active_dispatches,
        COUNT(*) FILTER (WHERE status::text IN ('created', 'accepted', 'preparing', 'scheduled_confirmed'))::int AS kitchen_backlog,
        COALESCE(SUM(total_amount), 0)::numeric AS total_gmv,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_method::text IN ('cod', 'CASH_ON_DELIVERY')), 0)::numeric AS total_cod_volume,
        COALESCE(SUM(total_amount) FILTER (WHERE payment_method::text NOT IN ('cod', 'CASH_ON_DELIVERY')), 0)::numeric AS total_digital_volume,
        COALESCE(SUM(cod_cash_received), 0)::numeric AS total_cod_collected,
        COALESCE(SUM(delivery_fee), 0)::numeric AS total_delivery_fees,
        COALESCE(SUM(service_fee), 0)::numeric AS total_service_fees,
        COALESCE(SUM(convenience_fee), 0)::numeric AS total_convenience_fees
      FROM orders
    `);
    const totals = Array.isArray(platformTotalsResult)
      ? platformTotalsResult[0]
      : (platformTotalsResult?.rows?.[0] || {});

    // 2. Compute Platform Commissions & Merchant Payables
    const merchantCommissionsResult: any = await db.execute(sql`
      SELECT 
        COALESCE(SUM(
          (o.total_amount - COALESCE(o.delivery_fee, 0) - COALESCE(o.service_fee, 0) - COALESCE(o.convenience_fee, 0)) * 
          (COALESCE(v.commission_bps, 1000)::numeric / 10000.0)
        ), 0)::numeric AS retained_commission,
        COALESCE(SUM(
          (o.total_amount - COALESCE(o.delivery_fee, 0) - COALESCE(o.service_fee, 0) - COALESCE(o.convenience_fee, 0)) * 
          (1.0 - (COALESCE(v.commission_bps, 1000)::numeric / 10000.0))
        ), 0)::numeric AS merchant_payable_volume
      FROM orders o
      LEFT JOIN vendors v ON o.vendor_id = v.id
      WHERE o.status::text = 'delivered'
    `);
    const merchantCommissions = Array.isArray(merchantCommissionsResult)
      ? merchantCommissionsResult[0]
      : (merchantCommissionsResult?.rows?.[0] || {});

    // 3. Counts for Hierarchy Tiers
    const entityCountsResult: any = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*)::int FROM users WHERE role::text IN ('admin', 'super_admin')) AS admin_count,
        (SELECT COUNT(*)::int FROM users WHERE role::text = 'customer' OR role IS NULL) AS customer_count,
        (SELECT COUNT(*)::int FROM vendors) AS vendor_count,
        (SELECT COUNT(*)::int FROM vendors WHERE is_accepting_orders = true) AS active_vendor_count,
        (SELECT COUNT(*)::int FROM riders) AS rider_count,
        (SELECT COUNT(*)::int FROM riders WHERE is_active = true AND NOT COALESCE(is_locked, false)) AS active_rider_count,
        (SELECT COUNT(*)::int FROM riders WHERE is_locked = true OR wallet_balance >= 50000.00) AS locked_rider_count
    `);
    const entityCounts = Array.isArray(entityCountsResult)
      ? entityCountsResult[0]
      : (entityCountsResult?.rows?.[0] || {});

    // 4. Street Cash Liquidity at Risk (Riders carrying physical cash)
    const fleetRiskResult: any = await db.execute(sql`
      SELECT 
        r.id::text AS id,
        r.name AS rider_name,
        r.phone AS rider_phone,
        r.vehicle_plate,
        COALESCE(r.wallet_balance, 0)::numeric AS total_cash_collected,
        COALESCE(r.max_cash_limit, 50000.00)::numeric AS max_cash_limit,
        COALESCE(r.is_locked, false) AS is_locked,
        COUNT(o.id) FILTER (WHERE o.status::text IN ('rider_assigned', 'dispatched'))::int AS active_deliveries
      FROM riders r
      LEFT JOIN orders o ON o.assigned_rider_id = r.id
      GROUP BY r.id, r.name, r.phone, r.vehicle_plate, r.wallet_balance, r.max_cash_limit, r.is_locked
      ORDER BY r.wallet_balance DESC, total_cash_collected DESC
      LIMIT 6
    `);
    const fleetRisk = Array.isArray(fleetRiskResult)
      ? fleetRiskResult
      : (fleetRiskResult?.rows || []);

    // 5. Recent Settlement Activity
    const recentSettlementsResult: any = await db.execute(sql`
      SELECT 
        o.id::text AS id,
        o.order_number,
        o.status::text AS status,
        o.payment_method::text AS payment_method,
        o.total_amount,
        o.delivery_pin,
        o.cod_cash_received,
        o.cod_verified_at,
        o.created_at,
        u.phone AS customer_phone,
        r.name AS rider_name,
        v.name AS vendor_name
      FROM orders o
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN riders r ON o.assigned_rider_id = r.id
      LEFT JOIN vendors v ON o.vendor_id = v.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `);
    const recentSettlements = Array.isArray(recentSettlementsResult)
      ? recentSettlementsResult
      : (recentSettlementsResult?.rows || []);

    const netRetained = Number(merchantCommissions.retained_commission || 0) +
                        Number(totals.total_service_fees || 0) +
                        Number(totals.total_convenience_fees || 0);

    return NextResponse.json({
      success: true,
      data: {
        totals: {
          gmv: Number(totals.total_gmv || 0),
          netPlatformRevenue: netRetained,
          retainedCommission: Number(merchantCommissions.retained_commission || 0),
          merchantPayableVolume: Number(merchantCommissions.merchant_payable_volume || 0),
          codVolume: Number(totals.total_cod_volume || 0),
          digitalVolume: Number(totals.total_digital_volume || 0),
          codCollected: Number(totals.total_cod_collected || 0),
          totalOrders: Number(totals.total_orders || 0),
          deliveredOrders: Number(totals.delivered_orders || 0),
          activeDispatches: Number(totals.active_dispatches || 0),
          kitchenBacklog: Number(totals.kitchen_backlog || 0),
          feeBreakdown: {
            service: Number(totals.total_service_fees || 0),
            convenience: Number(totals.total_convenience_fees || 0),
            delivery: Number(totals.total_delivery_fees || 0),
          }
        },
        entities: {
          admins: Number(entityCounts.admin_count || 0),
          vendors: Number(entityCounts.vendor_count || 0),
          activeVendors: Number(entityCounts.active_vendor_count || 0),
          riders: Number(entityCounts.rider_count || 0),
          activeRiders: Number(entityCounts.active_rider_count || 0),
          lockedRiders: Number(entityCounts.locked_rider_count || 0),
          customers: Number(entityCounts.customer_count || 0),
        },
        fleetRisk,
        recentSettlements
      }
    });
  } catch (error: any) {
    console.error('[SUPER_ADMIN_METRICS_ERROR]:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch platform metrics' },
      { status: 500 }
    );
  }
}
