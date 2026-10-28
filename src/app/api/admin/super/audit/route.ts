import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const logsResult: any = await db.execute(sql`
      SELECT 
        l.id::text AS id,
        l.actor_id::text AS "actorId",
        l.actor_role AS "actorRole",
        l.action,
        l.target_entity AS "targetEntity",
        l.target_id::text AS "targetId",
        l.metadata,
        l.ip_address AS "ipAddress",
        l.created_at AS "createdAt",
        u.phone AS "actorPhone"
      FROM platform_audit_logs l
      LEFT JOIN users u ON l.actor_id = u.id
      ORDER BY l.created_at DESC
      LIMIT 50
    `);

    const logs = Array.isArray(logsResult) ? logsResult : (logsResult?.rows || []);

    return NextResponse.json({
      success: true,
      logs
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
