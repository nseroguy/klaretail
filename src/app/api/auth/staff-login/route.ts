import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { verifyPassword, generateOtp } from '@/utils/security';
import { logPlatformAudit } from '@/utils/auditLogger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { phone, password, otp } = await request.json();

    if (!phone) {
      return NextResponse.json({ success: false, message: 'Phone number is required.' }, { status: 400 });
    }

    const cleanPhone = phone.trim();

    const userResult: any = await db.execute(sql`
      SELECT 
        id::text AS id, 
        phone, 
        role::text AS role, 
        is_active AS "isActive",
        password_hash AS "passwordHash",
        otp_code AS "otpCode",
        otp_expires_at AS "otpExpiresAt",
        COALESCE(mfa_enabled, false) AS "mfaEnabled"
      FROM users
      WHERE phone = ${cleanPhone}
      LIMIT 1
    `);

    const user = Array.isArray(userResult) ? userResult[0] : userResult?.rows?.[0];

    if (!user) {
      return NextResponse.json({ success: false, message: 'Staff identity not registered in system.' }, { status: 404 });
    }

    if (!user.isActive) {
      return NextResponse.json({ success: false, message: 'Account suspended by operations.' }, { status: 403 });
    }

    const allowedRoles = ['super_admin', 'admin', 'vendor_owner', 'rider'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ success: false, message: 'Access denied: Insufficient privileges.' }, { status: 403 });
    }

    if (otp) {
      if (!user.otpCode || !user.otpExpiresAt) {
        return NextResponse.json({ success: false, message: 'No pending OTP verification request.' }, { status: 400 });
      }

      if (new Date() > new Date(user.otpExpiresAt)) {
        return NextResponse.json({ success: false, message: 'Verification OTP has expired. Please request a new one.' }, { status: 400 });
      }

      if (String(user.otpCode).trim() !== String(otp).trim()) {
        return NextResponse.json({ success: false, message: 'Invalid 6-digit OTP code.' }, { status: 401 });
      }

      await db.execute(sql`
        UPDATE users 
        SET otp_code = NULL, otp_expires_at = NULL, updated_at = NOW() 
        WHERE id = ${user.id}::uuid
      `);

      return issueStaffSession(request, user, 'PASSWORD_PLUS_OTP');
    }

    if (!password) {
      return NextResponse.json({ success: false, message: 'Password is required.' }, { status: 400 });
    }

    if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      await logPlatformAudit({
        request,
        action: 'STAFF_LOGIN_FAILED',
        targetEntity: 'users',
        targetId: user.id,
        actorId: user.id,
        actorRole: user.role,
        metadata: { phone: cleanPhone, reason: 'INVALID_PASSWORD' }
      });
      return NextResponse.json({ success: false, message: 'Invalid staff credentials.' }, { status: 401 });
    }

    if (user.mfaEnabled) {
      const { code, expiresAt } = generateOtp(6);

      await db.execute(sql`
        UPDATE users 
        SET otp_code = ${code}, 
            otp_expires_at = ${expiresAt.toISOString()}, 
            updated_at = NOW()
        WHERE id = ${user.id}::uuid
      `);

      console.log(`[AUTH OTP DISPATCH] Phone: ${cleanPhone} | OTP: ${code} | Valid until: ${expiresAt.toISOString()}`);

      await logPlatformAudit({
        request,
        action: 'STAFF_OTP_ISSUED',
        targetEntity: 'users',
        targetId: user.id,
        actorId: user.id,
        actorRole: user.role,
        metadata: { phone: cleanPhone }
      });

      return NextResponse.json({
        success: true,
        mfaRequired: true,
        message: 'Password verified. Enter the 6-digit verification code sent to your phone.',
        phone: cleanPhone
      });
    }

    return issueStaffSession(request, user, 'PASSWORD_ONLY');

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Login failed.' }, { status: 500 });
  }
}

async function issueStaffSession(request: NextRequest, user: any, authMethod: string) {
  const sessionPayload = {
    id: user.id,
    phone: user.phone,
    role: user.role,
    authMethod,
    issuedAt: new Date().toISOString(),
  };

  await logPlatformAudit({
    request,
    action: 'STAFF_USER_LOGIN',
    targetEntity: 'users',
    targetId: user.id,
    actorId: user.id,
    actorRole: user.role,
    metadata: { phone: user.phone, role: user.role, authMethod }
  });

  const redirectUrl = user.role === 'super_admin' 
    ? '/admin/super' 
    : user.role === 'rider' 
    ? '/dispatch' 
    : '/admin';

  const response = NextResponse.json({
    success: true,
    message: `Authenticated successfully as ${user.role}.`,
    user: sessionPayload,
    redirectUrl
  });

  // Next.js handles cookie encoding natively; pass JSON string without double encodeURIComponent
    const cookieOptions = {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };

  const strPayload = JSON.stringify(sessionPayload);
  response.cookies.set({ name: "staff_session", value: strPayload, ...cookieOptions });
  response.cookies.set({ name: "session_token", value: strPayload, ...cookieOptions });
  if (user.role === "super_admin") {
    response.cookies.set({ name: "super_admin_session", value: strPayload, ...cookieOptions });
  }

  return response;
}
