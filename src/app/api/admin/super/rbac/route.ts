import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const usersResult: any = await db.execute(sql`
      SELECT 
        id::text AS id,
        phone,
        role::text AS role,
        trust_level AS "trustLevel",
        is_active AS "isActive",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM users
      ORDER BY 
        CASE 
          WHEN role::text = 'super_admin' THEN 1
          WHEN role::text = 'admin' THEN 2
          WHEN role::text = 'vendor_owner' THEN 3
          WHEN role::text = 'rider' THEN 4
          ELSE 5
        END,
        created_at DESC
      LIMIT 100
    `);

    const users = Array.isArray(usersResult) ? usersResult : (usersResult?.rows || []);

    return NextResponse.json({
      success: true,
      users
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to query users' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, newRole, action } = body;

    if (!userId) {
      return NextResponse.json({ success: false, message: 'userId is required' }, { status: 400 });
    }

    if (action === 'toggle_active') {
      const updateResult: any = await db.execute(sql`
        UPDATE users 
        SET is_active = NOT is_active, updated_at = NOW() 
        WHERE id = ${userId}::uuid
        RETURNING id, phone, is_active, role
      `);
      const user = Array.isArray(updateResult) ? updateResult[0] : updateResult?.rows?.[0];

      await logPlatformAudit({
        request,
        action: user?.is_active ? 'USER_ACCOUNT_REACTIVATED' : 'USER_ACCOUNT_SUSPENDED',
        targetEntity: 'users',
        targetId: userId,
        metadata: { phone: user?.phone, role: user?.role, isActive: user?.is_active }
      });

      return NextResponse.json({ success: true, message: `Account status updated.` });
    }

    if (action === 'change_role') {
      const allowedRoles = ['super_admin', 'admin', 'vendor_owner', 'rider', 'customer'];
      if (!allowedRoles.includes(newRole)) {
        return NextResponse.json({ success: false, message: 'Invalid role enum value' }, { status: 400 });
      }

      const updateResult: any = await db.execute(sql`
        UPDATE users 
        SET role = ${newRole}::user_role, updated_at = NOW() 
        WHERE id = ${userId}::uuid
        RETURNING id, phone, role
      `);
      const user = Array.isArray(updateResult) ? updateResult[0] : updateResult?.rows?.[0];

      await logPlatformAudit({
        request,
        action: 'RBAC_ROLE_MUTATION',
        targetEntity: 'users',
        targetId: userId,
        metadata: { phone: user?.phone, assignedRole: newRole }
      });

      return NextResponse.json({
        success: true,
        message: `Role for ${user?.phone} updated to ${newRole}.`
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid RBAC action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'RBAC update failed' },
      { status: 500 }
    );
  }
}
