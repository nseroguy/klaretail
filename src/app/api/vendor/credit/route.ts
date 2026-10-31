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

    const facilityRows: any = await db.execute(sql`
      SELECT 
        id,
        credit_limit AS "creditLimit",
        available_credit AS "availableCredit",
        drawn_amount AS "drawnAmount",
        interest_rate_bps AS "interestRateBps",
        max_tenor_days AS "maxTenorDays",
        status
      FROM vendor_credit_facilities
      WHERE vendor_id = ${vendorId}::uuid
      LIMIT 1;
    `);

    const facility = Array.isArray(facilityRows) ? facilityRows[0] : facilityRows?.rows?.[0];

    if (!facility) {
      return NextResponse.json({ success: true, hasFacility: false, facility: null });
    }

    return NextResponse.json({
      success: true,
      hasFacility: true,
      facility: {
        ...facility,
        creditLimit: Number(facility.creditLimit),
        availableCredit: Number(facility.availableCredit),
        drawnAmount: Number(facility.drawnAmount),
        interestRateBps: Number(facility.interestRateBps || 250),
        maxTenorDays: Number(facility.maxTenorDays || 14),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
