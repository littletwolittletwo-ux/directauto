import { prisma } from './prisma'

export interface PnLResult {
  period: { from: string; to: string }
  revenue: {
    totalCents: number
    invoiceCount: number
    byMonth: { month: string; amountCents: number }[]
  }
  costs: {
    totalCents: number
    byCategory: { categoryName: string; amountCents: number }[]
    byMonth: { month: string; amountCents: number }[]
  }
  grossProfitCents: number
  grossMarginPercent: number | null
  perVehicle: {
    vehicleId: string
    vehicleDescription: string
    revenueCents: number
    gstCents: number
    totalInvoiceCents: number
    costCents: number
    costBreakdown: { categoryName: string; amountCents: number }[]
    marginCents: number
    marginPercent: number | null
  }[]
}

export async function calculatePnL(dateFrom: string, dateTo: string): Promise<PnLResult> {
  const from = new Date(dateFrom)
  const to = new Date(dateTo + 'T23:59:59.999Z')

  // Fetch invoices and expenses in the date range
  const [invoices, expenses] = await Promise.all([
    prisma.applicationInvoice.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: {
        vehicleId: true,
        vehicleDescription: true,
        subtotalCents: true,
        gstCents: true,
        totalCents: true,
        createdAt: true,
      },
    }),
    prisma.applicationExpense.findMany({
      where: { expenseDate: { gte: from, lte: to } },
      include: { category: { select: { name: true } } },
    }),
  ])

  // Revenue totals
  const revenueTotalCents = invoices.reduce((s, i) => s + i.subtotalCents, 0)

  // Revenue by month
  const revenueByMonth = new Map<string, number>()
  for (const inv of invoices) {
    const key = `${inv.createdAt.getFullYear()}-${String(inv.createdAt.getMonth() + 1).padStart(2, '0')}`
    revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + inv.subtotalCents)
  }

  // Cost totals
  const costTotalCents = expenses.reduce((s, e) => s + e.amountCents, 0)

  // Cost by category
  const costByCategory = new Map<string, number>()
  for (const exp of expenses) {
    const cat = exp.category.name
    costByCategory.set(cat, (costByCategory.get(cat) || 0) + exp.amountCents)
  }

  // Cost by month
  const costByMonth = new Map<string, number>()
  for (const exp of expenses) {
    const key = `${exp.expenseDate.getFullYear()}-${String(exp.expenseDate.getMonth() + 1).padStart(2, '0')}`
    costByMonth.set(key, (costByMonth.get(key) || 0) + exp.amountCents)
  }

  // Per-vehicle breakdown
  const vehicleRevenue = new Map<string, { desc: string; subtotalCents: number; gstCents: number; totalCents: number }>()
  for (const inv of invoices) {
    const existing = vehicleRevenue.get(inv.vehicleId)
    vehicleRevenue.set(inv.vehicleId, {
      desc: inv.vehicleDescription,
      subtotalCents: (existing?.subtotalCents || 0) + inv.subtotalCents,
      gstCents: (existing?.gstCents || 0) + inv.gstCents,
      totalCents: (existing?.totalCents || 0) + inv.totalCents,
    })
  }

  const vehicleCosts = new Map<string, number>()
  const vehicleCostBreakdown = new Map<string, Map<string, number>>()
  for (const exp of expenses) {
    vehicleCosts.set(exp.vehicleId, (vehicleCosts.get(exp.vehicleId) || 0) + exp.amountCents)
    if (!vehicleCostBreakdown.has(exp.vehicleId)) {
      vehicleCostBreakdown.set(exp.vehicleId, new Map())
    }
    const catMap = vehicleCostBreakdown.get(exp.vehicleId)!
    catMap.set(exp.category.name, (catMap.get(exp.category.name) || 0) + exp.amountCents)
  }

  // Merge vehicle IDs
  const allVehicleIds = new Set([...vehicleRevenue.keys(), ...vehicleCosts.keys()])

  const perVehicle = Array.from(allVehicleIds).map((vid) => {
    const rev = vehicleRevenue.get(vid)
    const revCents = rev?.subtotalCents || 0
    const gstCents = rev?.gstCents || 0
    const totalInvoiceCents = rev?.totalCents || 0
    const costCents = vehicleCosts.get(vid) || 0
    const marginCents = revCents - costCents
    const marginPercent = revCents > 0 ? Math.round((marginCents / revCents) * 1000) / 10 : null

    const catMap = vehicleCostBreakdown.get(vid)
    const costBreakdown = catMap
      ? Array.from(catMap.entries())
          .map(([categoryName, amountCents]) => ({ categoryName, amountCents }))
          .sort((a, b) => b.amountCents - a.amountCents)
      : []

    return {
      vehicleId: vid,
      vehicleDescription: rev?.desc || 'Unknown Vehicle',
      revenueCents: revCents,
      gstCents,
      totalInvoiceCents,
      costCents,
      costBreakdown,
      marginCents,
      marginPercent,
    }
  })

  const grossProfitCents = revenueTotalCents - costTotalCents
  const grossMarginPercent = revenueTotalCents > 0
    ? Math.round((grossProfitCents / revenueTotalCents) * 1000) / 10
    : null

  return {
    period: { from: dateFrom, to: dateTo },
    revenue: {
      totalCents: revenueTotalCents,
      invoiceCount: invoices.length,
      byMonth: Array.from(revenueByMonth.entries())
        .map(([month, amountCents]) => ({ month, amountCents }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    },
    costs: {
      totalCents: costTotalCents,
      byCategory: Array.from(costByCategory.entries())
        .map(([categoryName, amountCents]) => ({ categoryName, amountCents }))
        .sort((a, b) => b.amountCents - a.amountCents),
      byMonth: Array.from(costByMonth.entries())
        .map(([month, amountCents]) => ({ month, amountCents }))
        .sort((a, b) => a.month.localeCompare(b.month)),
    },
    grossProfitCents,
    grossMarginPercent,
    perVehicle: perVehicle.sort((a, b) => b.marginCents - a.marginCents),
  }
}
