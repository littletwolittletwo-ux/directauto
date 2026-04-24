import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { calculatePnL } from '@/lib/pnl-service'

function esc(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2)
}

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

    const lines: string[] = []

    // ── REPORT HEADER ──
    lines.push(`Direct Auto — Profit & Loss Report`)
    lines.push(`Period: ${from} to ${to}`)
    lines.push('')

    // ── SUMMARY ──
    lines.push('SUMMARY')
    lines.push('Metric,Amount (AUD)')
    lines.push(`Total Revenue (ex. GST),${dollars(report.revenue.totalCents)}`)
    lines.push(`Total GST Collected,${dollars(report.perVehicle.reduce((s, v) => s + v.gstCents, 0))}`)
    lines.push(`Total Invoiced (inc. GST),${dollars(report.perVehicle.reduce((s, v) => s + v.totalInvoiceCents, 0))}`)
    lines.push(`Total Costs,${dollars(report.costs.totalCents)}`)
    lines.push(`Gross Profit,${dollars(report.grossProfitCents)}`)
    lines.push(`Gross Margin %,${report.grossMarginPercent ?? 0}%`)
    lines.push(`Number of Invoices,${report.revenue.invoiceCount}`)
    lines.push(`Number of Vehicles,${report.perVehicle.length}`)
    lines.push('')

    // ── REVENUE BY MONTH ──
    if (report.revenue.byMonth.length > 0) {
      lines.push('REVENUE BY MONTH')
      lines.push('Month,Revenue (AUD)')
      for (const m of report.revenue.byMonth) {
        lines.push(`${m.month},${dollars(m.amountCents)}`)
      }
      lines.push('')
    }

    // ── COSTS BY MONTH ──
    if (report.costs.byMonth.length > 0) {
      lines.push('COSTS BY MONTH')
      lines.push('Month,Costs (AUD)')
      for (const m of report.costs.byMonth) {
        lines.push(`${m.month},${dollars(m.amountCents)}`)
      }
      lines.push('')
    }

    // ── COSTS BY CATEGORY ──
    if (report.costs.byCategory.length > 0) {
      lines.push('COSTS BY CATEGORY')
      lines.push('Category,Amount (AUD),% of Total Costs')
      for (const c of report.costs.byCategory) {
        const pct = report.costs.totalCents > 0
          ? ((c.amountCents / report.costs.totalCents) * 100).toFixed(1)
          : '0.0'
        lines.push(`${esc(c.categoryName)},${dollars(c.amountCents)},${pct}%`)
      }
      lines.push('')
    }

    // ── PER-VEHICLE P&L ──
    lines.push('PER-VEHICLE PROFIT & LOSS')

    // Collect all unique cost categories across vehicles for columns
    const allCategories = new Set<string>()
    for (const v of report.perVehicle) {
      for (const cb of v.costBreakdown) {
        allCategories.add(cb.categoryName)
      }
    }
    const categoryList = Array.from(allCategories).sort()

    // Header row
    const vehicleHeaders = [
      'Vehicle',
      'Revenue (ex. GST)',
      'GST',
      'Total Invoiced (inc. GST)',
      'Total Costs',
      ...categoryList.map(c => `Cost: ${c}`),
      'Gross Margin ($)',
      'Gross Margin (%)',
    ]
    lines.push(vehicleHeaders.map(esc).join(','))

    // Data rows
    for (const v of report.perVehicle) {
      const catAmounts = categoryList.map(cat => {
        const found = v.costBreakdown.find(cb => cb.categoryName === cat)
        return found ? dollars(found.amountCents) : '0.00'
      })

      const row = [
        esc(v.vehicleDescription),
        dollars(v.revenueCents),
        dollars(v.gstCents),
        dollars(v.totalInvoiceCents),
        dollars(v.costCents),
        ...catAmounts,
        dollars(v.marginCents),
        v.marginPercent !== null ? `${v.marginPercent}%` : 'N/A',
      ]
      lines.push(row.join(','))
    }

    // Totals row
    const totalCatAmounts = categoryList.map(cat => {
      const catEntry = report.costs.byCategory.find(c => c.categoryName === cat)
      return catEntry ? dollars(catEntry.amountCents) : '0.00'
    })
    const totalsRow = [
      'TOTAL',
      dollars(report.revenue.totalCents),
      dollars(report.perVehicle.reduce((s, v) => s + v.gstCents, 0)),
      dollars(report.perVehicle.reduce((s, v) => s + v.totalInvoiceCents, 0)),
      dollars(report.costs.totalCents),
      ...totalCatAmounts,
      dollars(report.grossProfitCents),
      report.grossMarginPercent !== null ? `${report.grossMarginPercent}%` : 'N/A',
    ]
    lines.push(totalsRow.join(','))

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
