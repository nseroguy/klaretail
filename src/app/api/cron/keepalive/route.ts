import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1;`);
    return NextResponse.json({
      status: 'online',
      service: 'KlaRetail Backend',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'database_unavailable', error: error.message },
      { status: 500 }
    );
  }
}
