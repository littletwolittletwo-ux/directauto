import { prisma } from './prisma'

export interface MarginResult {
  totalCostCents: number
  salePriceCents: number | null
  grossMarginCents: number | null
  grossMarginPercent: number | null
  expenseCount: number
}

/**
 * Calculate margin for a vehicle application.
 * Revenue comes from the latest invoice. Costs come from all expenses.
 */
export async function calculateMargin(vehicleId: string): Promise<MarginResult> {
  const [expenses, latestInvoice] = await Promise.all([
    prisma.applicationExpense.findMany({
      where: { vehicleId },
      select: { amountCents: true },
    }),
    prisma.applicationInvoice.findFirst({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
      select: { subtotalCents: true },
    }),
  ])

  const totalCostCents = expenses.reduce((sum, e) => sum + e.amountCents, 0)
  const salePriceCents = latestInvoice?.subtotalCents ?? null

  let grossMarginCents: number | null = null
  let grossMarginPercent: number | null = null

  if (salePriceCents !== null) {
    grossMarginCents = salePriceCents - totalCostCents
    grossMarginPercent = salePriceCents > 0
      ? Math.round((grossMarginCents / salePriceCents) * 1000) / 10
      : null
  }

  return {
    totalCostCents,
    salePriceCents,
    grossMarginCents,
    grossMarginPercent,
    expenseCount: expenses.length,
  }
}
