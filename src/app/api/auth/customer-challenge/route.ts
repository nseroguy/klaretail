import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { normalizeUgandanPhone, dispatchOtpNotification } from '@/utils/phoneUtils';
import { generateOtp } from '@/utils/security';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawPhone = body?.phone;

    if (!rawPhone) {
      return NextResponse.json({ success: false, message: 'Phone number is required.' }, { status: 400 });
    }

    const phone = normalizeUgandanPhone(rawPhone);
    if (!phone) {
      return NextResponse.json({
        success: false,
        message: 'Invalid Ugandan phone number. Must be a valid MTN, Airtel, or Lyca number (e.g. 0701234567 or +256701234567).'
      }, { status: 422 });
    }

    // 1. Check if user already exists
    const existingUserResult: any = await db.execute(sql`
      SELECT 
        u.id::text AS id,
        u.is_active AS "isActive",
        c.id::text AS "customerId",
        c.full_name AS "fullName"
      FROM users u
      LEFT JOIN customers c ON c.user_id = u.id
      WHERE u.phone = ${phone}
      LIMIT 1
    `);

    const existingUser = Array.isArray(existingUserResult) 
      ? existingUserResult[0] 
      : existingUserResult?.rows?.[0];

    if (existingUser && existingUser.isActive === false) {
      return NextResponse.json({
        success: false,
        message: 'This account has been suspended. Please contact KlaRetail support.'
      }, { status: 403 });
    }

    const isReturningCustomer = Boolean(existingUser && existingUser.customerId);
    const { code, expiresAt } = generateOtp(6);

    if (existingUser) {
      // Update existing user with fresh challenge
      await db.execute(sql`
        UPDATE users
        SET otp_code = ${code},
            otp_expires_at = ${expiresAt.toISOString()},
            updated_at = NOW()
        WHERE id = ${existingUser.id}::uuid
      `);
    } else {
      // Upsert temporary user shell to hold OTP until verified
      await db.execute(sql`
        INSERT INTO users (phone, role, is_active, otp_code, otp_expires_at, created_at, updated_at)
        VALUES (${phone}, 'customer', true, ${code}, ${expiresAt.toISOString()}, NOW(), NOW())
        ON CONFLICT (phone) DO UPDATE 
        SET otp_code = EXCLUDED.otp_code,
            otp_expires_at = EXCLUDED.otp_expires_at,
            updated_at = NOW()
      `);
    }

    // 2. Dispatch OTP via SMS/WhatsApp
    await dispatchOtpNotification(phone, code);

    return NextResponse.json({
      success: true,
      message: isReturningCustomer
        ? `Verification code sent to ${phone}.`
        : `Welcome to KlaRetail! Verification code sent to ${phone}.`,
      isReturningCustomer,
      customerName: existingUser?.fullName || null,
      phone
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to initiate customer challenge.'
    }, { status: 500 });
  }
}
