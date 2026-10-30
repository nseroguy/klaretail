import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const rawCookie = 
      req.cookies.get('session_token')?.value || 
      req.cookies.get('staff_session')?.value || 
      req.cookies.get('klaretail_session')?.value ||
      req.cookies.get('vendor_session')?.value;

    if (!rawCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Session missing.' }, { status: 401 });
    }

    let session: any;
    try {
      let dec = rawCookie;
      while (dec.includes('%')) dec = decodeURIComponent(dec);
      session = JSON.parse(dec);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid session format' }, { status: 401 });
    }

    const sessionUserId = session.id || session.userId || null;
    const sessionVendorSlug = session.vendorSlug || null;
    const sessionVendorId = session.vendorId || null;

    const walletRes: any = await db.execute(sql`
      SELECT w.id, w.balance, w.held_float AS "heldFloat", u.phone
      FROM wallets w
      JOIN users u ON w.user_id = u.id
      LEFT JOIN vendors v ON v.owner_id = u.id
      WHERE (${sessionUserId}::uuid IS NOT NULL AND u.id = ${sessionUserId}::uuid)
         OR (${sessionVendorId}::uuid IS NOT NULL AND v.id = ${sessionVendorId}::uuid)
         OR (${sessionVendorSlug}::text IS NOT NULL AND v.slug = ${sessionVendorSlug}::text)
      LIMIT 1;
    `);

    const wallet = Array.isArray(walletRes) ? walletRes[0] : walletRes?.rows?.[0];

    if (!wallet) {
      return NextResponse.json({
        success: true,
        wallet: { balance: 0, heldFloat: 0 },
        ledger: [],
      });
    }

    const ledgerRes: any = await db.execute(sql`
      SELECT 
        id, 
        entry_type AS "entryType", 
        amount, 
        balance_after AS "balanceAfter", 
        metadata, 
        created_at AS "createdAt"
      FROM wallet_ledger
      WHERE wallet_id = ${wallet.id}::uuid
      ORDER BY created_at DESC
      LIMIT 15;
    `);

    const ledger = Array.isArray(ledgerRes) ? ledgerRes : ledgerRes?.rows || [];

    return NextResponse.json({
      success: true,
      wallet: {
        id: wallet.id,
        balance: Number(wallet.balance),
        heldFloat: Number(wallet.heldFloat),
        phone: wallet.phone,
      },
      ledger,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
