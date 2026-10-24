// src/app/api/cron/reconcile-payments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { reconcileStuckPayments } from '@/services/paymentReconciliation';

export async function GET(req: NextRequest) {
  // Validate authorization header for cron triggers
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized invocation' }, { status: 401 });
  }

  try {
    const summary = await reconcileStuckPayments();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
    });
  } catch (error: any) {
    console.error('Fatal cron execution error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Reconciliation failed' },
      { status: 500 }
    );
  }
}