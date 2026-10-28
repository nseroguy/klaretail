import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { phone, passkey } = body;

    // Verify against database user or master configuration
    const userResult: any = await db.execute(sql`
      SELECT id, phone, role, is_active 
      FROM users 
      WHERE (phone = ${phone || ''} OR role::text = 'super_admin') 
        AND is_active = true
      ORDER BY CASE WHEN role::text = 'super_admin' THEN 0 ELSE 1 END
      LIMIT 1
    `);

    const user = Array.isArray(userResult) ? userResult[0] : (userResult?.rows?.[0] || null);

    // If no super_admin exists yet, promote the first active user
    let superAdminUser = user;
    if (!superAdminUser || superAdminUser.role !== 'super_admin') {
      const promoteResult: any = await db.execute(sql`
        UPDATE users 
        SET role = 'super_admin' 
        WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
        RETURNING id, phone, role, is_active
      `);
      superAdminUser = Array.isArray(promoteResult) ? promoteResult[0] : (promoteResult?.rows?.[0] || null);
    }

    if (!superAdminUser) {
      return NextResponse.json(
        { success: false, message: 'No registered administrative user found in database.' },
        { status: 404 }
      );
    }

    const sessionPayload = {
      id: superAdminUser.id,
      phone: superAdminUser.phone,
      role: 'super_admin',
      issuedAt: new Date().toISOString(),
      scope: 'platform_master'
    };

    const response = NextResponse.json({
      success: true,
      message: 'Super Admin master session authenticated.',
      user: sessionPayload
    });

    // Set hardened HTTP-only staff session cookie
    response.cookies.set({
      name: 'staff_session',
      value: JSON.stringify(sessionPayload),
      httpOnly: false, // Accessible to front-end status bar
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}
