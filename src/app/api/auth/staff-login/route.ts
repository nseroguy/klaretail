import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phone = body?.phone;

    if (!phone) {
      return NextResponse.json({ success: false, message: 'Phone number is required.' }, { status: 400 });
    }

    const cleanDigits = String(phone).replace(/\D/g, '');
    const plusFormatted = `+${cleanDigits}`;
    const localFormatted = cleanDigits.startsWith('256') ? `0${cleanDigits.slice(3)}` : String(phone);

    // Resilient raw SQL execution avoiding Drizzle enum serialization bugs
    const queryResult: any = await db.execute(sql`
      SELECT 
        id::text AS id, 
        phone, 
        role::text AS role, 
        is_active AS "isActive"
      FROM users 
      WHERE phone IN (${phone}, ${plusFormatted}, ${localFormatted}) 
      LIMIT 1
    `);

    const rows = Array.isArray(queryResult) ? queryResult : (queryResult?.rows || []);
    const user = rows[0];

    if (!user) {
      return NextResponse.json({ success: false, message: 'Staff identity not registered in system.' }, { status: 401 });
    }

    const userRole = String(user.role);
    const allowedRoles = ['super_admin', 'admin', 'vendor_owner'];
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json(
        { success: false, message: 'Access denied: Customer or rider identity cannot access staff operations.' },
        { status: 403 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        role: userRole,
      },
      redirectUrl: '/admin',
    });

    response.cookies.set({
      name: 'klaretail_staff_session',
      value: JSON.stringify({ id: user.id, role: userRole, phone: user.phone }),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error('Staff login error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
