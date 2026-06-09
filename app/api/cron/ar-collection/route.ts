import { NextRequest, NextResponse } from 'next/server'
import { runDailyCollectionCheck } from '@/lib/ar-collection'

/**
 * GET /api/cron/ar-collection
 *
 * Daily AR collection check. Designed to be called by Vercel Cron.
 * Processes all unpaid invoices and applies escalation actions.
 *
 * Protected by CRON_SECRET header (set in vercel.json).
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this automatically)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await runDailyCollectionCheck()

    return NextResponse.json({
      success: true,
      processed: summary.processed,
      actions: summary.actions,
      runAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[AR-COLLECTION-CRON] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Collection check failed' },
      { status: 500 }
    )
  }
}
