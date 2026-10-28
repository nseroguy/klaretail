import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logPlatformAudit } from '@/utils/auditLogger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawCookie = request.cookies.get('staff_session')?.value;
    if (!rawCookie) {
      return NextResponse.json({ success: false, message: 'Unauthorized: Courier session missing.' }, { status: 401 });
    }

    let decoded = rawCookie;
    while (decoded.includes('%')) decoded = decodeURIComponent(decoded);
    const session = JSON.parse(decoded);

    const phone = session?.phone;
    if (!phone) {
      return NextResponse.json({ success: false, message: 'Malformed session: phone required.' }, { status: 401 });
    }

    const { isAvailable } = await request.json();
    const targetStatus = Boolean(isAvailable);

    const updateResult: any = await db.execute(sql`
      UPDATE riders
      SET is_available = ${targetStatus},
          updated_at = NOW()
      WHERE phone = ${phone.trim()}::text
      RETURNING id::text AS id, name, is_available AS "isAvailable"
    `);

    const rider = Array.isArray(updateResult) ? updateResult[0] : updateResult?.rows?.[0];

    if (!rider) {
      return NextResponse.json({ success: false, message: 'Courier profile not found.' }, { status: 404 });
    }

    await logPlatformAudit({
      request,
      action: targetStatus ? 'COURIER_SHIFT_STARTED' : 'COURIER_SHIFT_PAUSED',
      targetEntity: 'riders',
      targetId: rider.id,
      actorId: session.id,
      actorRole: 'rider',
      metadata: {
        courier: rider.name,
        isAvailable: targetStatus
      }
    });

    return NextResponse.json({
      success: true,
      isAvailable: rider.isAvailable,
      message: `Shift status updated to ${targetStatus ? 'Available' : 'Offline'}.`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || 'Failed to update courier shift status.' }, { status: 500 });
  }
}
