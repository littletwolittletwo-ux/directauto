import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { calculatePnL } from '@/lib/pnl-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')

    if (!from || !to) {
      return NextResponse.json(
        { error: 'from and to date parameters are required (YYYY-MM-DD).' },
        { status: 400 }
      )
    }

    const report = await calculatePnL(from, to)
    return NextResponse.json(report)
  } catch (error) {
    console.error('[PNL_REPORT] Error:', error)
    return NextResponse.json({ error: 'Failed to generate P&L report.' }, { status: 500 })
  }
}
