import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const rawCookie =
      req.cookies.get('staff_session')?.value ||
      req.cookies.get('session_token')?.value ||
      req.cookies.get('klaretail_session')?.value;

    let vendorId: string | null = null;
    if (rawCookie) {
      try {
        let dec = rawCookie;
        while (dec.includes('%')) dec = decodeURIComponent(dec);
        const session = JSON.parse(dec);
        vendorId = session.vendorId || session.id || null;
      } catch {
        try {
          let b64 = rawCookie;
          while (b64.includes('%')) b64 = decodeURIComponent(b64);
          const session = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
          vendorId = session.vendorId || session.id || null;
        } catch {
          vendorId = null;
        }
      }
    }

    if (!vendorId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const orderRows: any = await db.execute(sql`
      SELECT 
        o.order_number AS "orderNumber",
        o.status,
        o.total_amount AS "totalAmount",
        o.payment_terms AS "paymentTerms",
        o.handover_pin AS "handoverPin",
        v.name AS "wholesalerName",
        o.created_at AS "createdAt"
      FROM b2b_purchase_orders o
      JOIN vendors v ON o.wholesaler_vendor_id = v.id
      WHERE o.retail_vendor_id = ${vendorId}::uuid
      ORDER BY o.created_at DESC;
    `);

    const orders = Array.isArray(orderRows) ? orderRows : orderRows?.rows || [];

    return NextResponse.json({
      success: true,
      orders: orders.map((o: any) => ({
        ...o,
        totalAmount: Number(o.totalAmount),
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
