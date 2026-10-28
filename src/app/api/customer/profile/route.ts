import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  try {
    const rawCookie = request.cookies.get('customer_session')?.value;
    if (!rawCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Customer session missing.' }, { status: 401 });
    }

    let session: any = null;
    try {
      let decoded = rawCookie;
      while (decoded.includes('%')) {
        decoded = decodeURIComponent(decoded);
      }
      session = JSON.parse(decoded);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid session cookie.' }, { status: 401 });
    }

    const { fullName, email, defaultAddress, defaultLandmark, division, newAddress } = await request.json();

    const customerId = session?.customerId;
    if (!customerId) {
      return NextResponse.json({ success: false, message: 'Invalid customer identifier.' }, { status: 400 });
    }

    // 1. Update Core Profile
    const updatedCustomerResult: any = await db.execute(sql`
      UPDATE customers
      SET 
        full_name = COALESCE(${fullName ? fullName.trim() : null}, full_name),
        email = COALESCE(${email ? email.trim() : null}, email),
        default_address = COALESCE(${defaultAddress ? defaultAddress.trim() : null}, default_address),
        default_landmark = COALESCE(${defaultLandmark ? defaultLandmark.trim() : null}, default_landmark),
        division = COALESCE(${division ? division.trim() : null}, division),
        updated_at = NOW()
      WHERE id = ${customerId}::uuid
      RETURNING 
        id::text AS id,
        user_id::text AS "userId",
        phone,
        full_name AS "fullName",
        email,
        default_address AS "defaultAddress",
        default_landmark AS "defaultLandmark",
        division,
        total_orders AS "totalOrders",
        lifetime_spend::numeric AS "lifetimeSpend"
    `);

    const customer = Array.isArray(updatedCustomerResult) ? updatedCustomerResult[0] : updatedCustomerResult?.rows?.[0];

    // 2. Add New Address if provided
    if (newAddress && newAddress.addressLine) {
      const isDefault = Boolean(newAddress.isDefault);
      if (isDefault) {
        await db.execute(sql`
          UPDATE customer_addresses 
          SET is_default = false 
          WHERE customer_id = ${customerId}::uuid
        `);
      }

      await db.execute(sql`
        INSERT INTO customer_addresses (
          customer_id, label, address_line, landmark, latitude, longitude, is_default, created_at
        ) VALUES (
          ${customerId}::uuid, 
          ${newAddress.label || 'Other'}, 
          ${newAddress.addressLine.trim()}, 
          ${newAddress.landmark ? newAddress.landmark.trim() : null},
          ${newAddress.latitude || null},
          ${newAddress.longitude || null},
          ${isDefault},
          NOW()
        )
      `);
    }

    // 3. Hydrate Full Address Book
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

    await logPlatformAudit({
      request,
      action: 'CUSTOMER_PROFILE_UPDATED',
      targetEntity: 'customers',
      targetId: customerId,
      actorId: session.userId,
      actorRole: 'customer',
      metadata: { customerId, updatedFields: Object.keys({ fullName, email, defaultAddress, defaultLandmark, division }).filter(k => !!k) }
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully.',
      customer,
      addresses
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to update customer profile.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
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
    if (!customerId) {
      return NextResponse.json({ success: false, message: 'Invalid customer identifier.' }, { status: 400 });
    }

    const customerResult: any = await db.execute(sql`
      SELECT 
        id::text AS id,
        user_id::text AS "userId",
        phone,
        full_name AS "fullName",
        email,
        default_address AS "defaultAddress",
        default_landmark AS "defaultLandmark",
        division,
        total_orders AS "totalOrders",
        lifetime_spend::numeric AS "lifetimeSpend"
      FROM customers
      WHERE id = ${customerId}::uuid
      LIMIT 1
    `);

    const customer = Array.isArray(customerResult) ? customerResult[0] : customerResult?.rows?.[0];
    if (!customer) {
      return NextResponse.json({ success: false, message: 'Customer profile not found.' }, { status: 404 });
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
      customer,
      addresses
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to fetch customer profile.' }, { status: 500 });
  }
}
