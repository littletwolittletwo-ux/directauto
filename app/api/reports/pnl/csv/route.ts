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
        { error: 'from and to date parameters are required.' },
        { status: 400 }
      )
    }

    const report = await calculatePnL(from, to)

    // Build CSV
    const lines: string[] = []
    lines.push('Type,Vehicle,Category,Amount')

    // Summary
    lines.push(`SUMMARY,Total Revenue,,$${(report.revenue.totalCents / 100).toFixed(2)}`)
    lines.push(`SUMMARY,Total Costs,,$${(report.costs.totalCents / 100).toFixed(2)}`)
    lines.push(`SUMMARY,Gross Profit,,$${(report.grossProfitCents / 100).toFixed(2)}`)
    lines.push(`SUMMARY,Gross Margin %,,${report.grossMarginPercent ?? 0}%`)
    lines.push('')

    // Per vehicle
    for (const v of report.perVehicle) {
      const desc = `"${v.vehicleDescription.replace(/"/g, '""')}"`
      if (v.revenueCents > 0) {
        lines.push(`REVENUE,${desc},Invoice,$${(v.revenueCents / 100).toFixed(2)}`)
      }
      if (v.costCents > 0) {
        lines.push(`COST,${desc},Expenses,$${(v.costCents / 100).toFixed(2)}`)
      }
    }

    // Costs by category
    lines.push('')
    lines.push('CATEGORY BREAKDOWN')
    for (const c of report.costs.byCategory) {
      lines.push(`COST_CATEGORY,,"${c.categoryName}",$${(c.amountCents / 100).toFixed(2)}`)
    }

    const csv = lines.join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="pnl-${from}-to-${to}.csv"`,
      },
    })
  } catch (error) {
    console.error('[PNL_CSV] Error:', error)
    return NextResponse.json({ error: 'Failed to generate CSV.' }, { status: 500 })
  }
}
