import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { normalizeUgandanPhone } from '@/utils/phoneUtils';
import { logPlatformAudit } from '@/utils/auditLogger';
import { verifyPassword } from '@/utils/security';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone: rawPhone, otp, code, password, fullName, initialAddress, landmark, division } = body;
    const inputOtp = otp || code;

    if (!rawPhone) {
      return NextResponse.json({ success: false, message: 'Phone number is required.' }, { status: 400 });
    }

    if (!password && !inputOtp) {
      return NextResponse.json({ success: false, message: 'Either a password or OTP code must be provided.' }, { status: 400 });
    }

    const phone = normalizeUgandanPhone(rawPhone);
    if (!phone) {
      return NextResponse.json({ success: false, message: 'Invalid Ugandan phone number format.' }, { status: 422 });
    }

    // 1. Fetch user by phone
    const userResult: any = await db.execute(sql`
      SELECT 
        u.id::text AS id,
        u.phone,
        u.role::text AS role,
        u.password_hash AS "passwordHash",
        u.is_active AS "isActive",
        u.otp_code AS "otpCode",
        u.otp_expires_at AS "otpExpiresAt",
        c.id::text AS "customerId",
        c.full_name AS "fullName"
      FROM users u
      LEFT JOIN customers c ON c.user_id = u.id
      WHERE u.phone = ${phone}
      LIMIT 1
    `);

    let user = Array.isArray(userResult) ? userResult[0] : userResult?.rows?.[0];

    if (!user) {
      return NextResponse.json({ success: false, message: 'No account found for this phone number.' }, { status: 404 });
    }

    if (!user.isActive) {
      return NextResponse.json({ success: false, message: 'Account is deactivated.' }, { status: 403 });
    }

    let authMethod = 'OTP';

    // 2. Authenticate via Password or OTP
    if (password) {
      if (!user.passwordHash) {
        return NextResponse.json({ 
          success: false, 
          message: 'No password set for this account. Please sign in with OTP.' 
        }, { status: 400 });
      }

      const isMatch = await verifyPassword(password, user.passwordHash);
      if (!isMatch) {
        return NextResponse.json({ success: false, message: 'Invalid phone or password.' }, { status: 401 });
      }
      authMethod = 'PASSWORD';
    } else {
      // Validate OTP
      if (!user.otpCode || !user.otpExpiresAt) {
        return NextResponse.json({ success: false, message: 'No pending OTP verification request. Request a new code.' }, { status: 400 });
      }

      if (new Date() > new Date(user.otpExpiresAt)) {
        return NextResponse.json({ success: false, message: 'Verification OTP has expired. Request a new code.' }, { status: 400 });
      }

      if (String(user.otpCode).trim() !== String(inputOtp).trim()) {
        return NextResponse.json({ success: false, message: 'Invalid 6-digit OTP code.' }, { status: 401 });
      }

      // Clear OTP immediately after successful verification
      await db.execute(sql`
        UPDATE users 
        SET otp_code = NULL, otp_expires_at = NULL, updated_at = NOW() 
        WHERE id = ${user.id}::uuid
      `);
    }

    // 3. Ensure Customer Record Exists
    let customerId = user.customerId;
    if (!customerId) {
      const customerInsert: any = await db.execute(sql`
        INSERT INTO customers (
          user_id, phone, full_name, default_address, default_landmark, division, created_at
        ) VALUES (
          ${user.id}::uuid, 
          ${phone}, 
          ${fullName || user.fullName || 'Valued Customer'}, 
          ${initialAddress || 'Kampala Drop-off'}, 
          ${landmark || null}, 
          ${division || 'Central'}, 
          NOW()
        )
        RETURNING id::text AS id
      `);
      const newCustomer = Array.isArray(customerInsert) ? customerInsert[0] : customerInsert?.rows?.[0];
      customerId = newCustomer?.id;
    }

    // 4. Create Session Cookie
    const sessionPayload = {
      userId: user.id,
      customerId,
      phone: user.phone,
      role: user.role || 'customer'
    };

    await logPlatformAudit({
      request,
      action: 'CUSTOMER_AUTHENTICATED',
      targetEntity: 'users',
      targetId: user.id,
      actorId: user.id,
      actorRole: 'customer',
      metadata: { phone, authMethod, customerId }
    });

    const response = NextResponse.json({
      success: true,
      message: 'Sign in successful.',
      customer: {
        id: customerId,
        userId: user.id,
        phone: user.phone,
        fullName: user.fullName
      }
    });

    response.cookies.set({
      name: 'customer_session',
      value: encodeURIComponent(JSON.stringify(sessionPayload)),
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Authentication failed.' }, { status: 500 });
  }
}
