import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawCookie = request.cookies.get('customer_session')?.value;
    if (!rawCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Session missing.' }, { status: 401 });
    }

    let session: any = null;
    try {
      let decoded = rawCookie;
      while (decoded.includes('%')) decoded = decodeURIComponent(decoded);
      session = JSON.parse(decoded);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid session token.' }, { status: 401 });
    }

    const customerId = session?.customerId;
    const { addressId, makeDefault } = await request.json();

    if (!addressId) {
      return NextResponse.json({ success: false, message: 'Address ID required.' }, { status: 400 });
    }

    if (makeDefault) {
      // Clear previous default
      await db.execute(sql`
        UPDATE customer_addresses 
        SET is_default = false 
        WHERE customer_id = ${customerId}::uuid
      `);

      // Set target address as default
      await db.execute(sql`
        UPDATE customer_addresses 
        SET is_default = true 
        WHERE id = ${addressId}::uuid AND customer_id = ${customerId}::uuid
      `);

      // Sync customer default_address text
      await db.execute(sql`
        UPDATE customers c
        SET default_address = a.address_line,
            default_landmark = a.landmark,
            updated_at = NOW()
        FROM customer_addresses a
        WHERE c.id = ${customerId}::uuid AND a.id = ${addressId}::uuid
      `);
    }

    const addressesResult: any = await db.execute(sql`
      SELECT 
        id::text AS id,
        label,
        address_line AS "addressLine",
        landmark,
        latitude,
        longitude,
        is_default AS "isDefault"
      FROM customer_addresses
      WHERE customer_id = ${customerId}::uuid
      ORDER BY is_default DESC, created_at DESC
    `);

    const addresses = Array.isArray(addressesResult) ? addressesResult : (addressesResult?.rows || []);

    return NextResponse.json({
      success: true,
      message: 'Default delivery address updated.',
      addresses
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to update address.' }, { status: 500 });
  }
}
