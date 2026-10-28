import { db } from '@/db';
import { sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

export interface AuditLogParams {
  request?: NextRequest;
  action: string;
  targetEntity: string;
  targetId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  metadata?: Record<string, any>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function logPlatformAudit(params: AuditLogParams): Promise<void> {
  try {
    const { request, action, targetEntity, targetId, actorId, actorRole, metadata = {} } = params;

    let ipAddress: string | null = null;
    if (request) {
      ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                  request.headers.get('x-real-ip') || 
                  null;
    }

    const safeTargetId = targetId && UUID_REGEX.test(targetId) ? targetId : null;
    const safeActorId = actorId && UUID_REGEX.test(actorId) ? actorId : null;
    const finalActorRole = actorRole || 'system';

    await db.execute(sql`
      INSERT INTO platform_audit_logs (
        actor_id,
        actor_role,
        action,
        target_entity,
        target_id,
        metadata,
        ip_address,
        created_at
      ) VALUES (
        ${safeActorId ? sql`${safeActorId}::uuid` : null},
        ${finalActorRole},
        ${action},
        ${targetEntity},
        ${safeTargetId ? sql`${safeTargetId}::uuid` : null},
        ${JSON.stringify(metadata)}::jsonb,
        ${ipAddress},
        NOW()
      )
    `);
  } catch (error: any) {
    console.error('[AUDIT_LOGGER_EXCEPTION]', error.message || error);
  }
}
