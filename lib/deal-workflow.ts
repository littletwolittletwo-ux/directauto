/**
 * Deal Workflow Engine
 *
 * Enforces the Direct Auto Platform Framework v2 deal lifecycle:
 * SOURCED → UNDER_OFFER → CONTRACT_SIGNED → COMMITTED →
 * APPROVED_FOR_PAYMENT → PAYMENT_READY → PAID → LISTED → SOLD → CLOSED
 *
 * Plus cancellation states: CANCELLED_DD_FAIL, CANCELLED_INSPECTION_FAIL
 *
 * Rules:
 * - Transitions must follow allowed paths
 * - Certain transitions require preconditions (e.g., inspection must pass)
 * - Status changes are audited automatically
 */

import { prisma } from './prisma'
import { logAudit } from './audit'
import { Prisma } from '@prisma/client'

export type DealStatus =
  | 'SOURCED'
  | 'UNDER_OFFER'
  | 'CONTRACT_SIGNED'
  | 'COMMITTED'
  | 'APPROVED_FOR_PAYMENT'
  | 'PAYMENT_READY'
  | 'PAID'
  | 'LISTED'
  | 'SOLD'
  | 'CLOSED'
  | 'CANCELLED_DD_FAIL'
  | 'CANCELLED_INSPECTION_FAIL'

// Allowed transitions (from → to[])
const TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  SOURCED: ['UNDER_OFFER', 'CANCELLED_DD_FAIL'],
  UNDER_OFFER: ['CONTRACT_SIGNED', 'CANCELLED_DD_FAIL'],
  CONTRACT_SIGNED: ['COMMITTED', 'CANCELLED_DD_FAIL', 'CANCELLED_INSPECTION_FAIL'],
  COMMITTED: ['APPROVED_FOR_PAYMENT', 'CANCELLED_DD_FAIL', 'CANCELLED_INSPECTION_FAIL'],
  APPROVED_FOR_PAYMENT: ['PAYMENT_READY', 'CANCELLED_DD_FAIL'],
  PAYMENT_READY: ['PAID', 'CANCELLED_DD_FAIL'],
  PAID: ['LISTED'],
  LISTED: ['SOLD'],
  SOLD: ['CLOSED'],
  CLOSED: [], // Terminal state
  CANCELLED_DD_FAIL: [], // Terminal state
  CANCELLED_INSPECTION_FAIL: [], // Terminal state
}

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkflowError'
  }
}

/**
 * Check if a transition from current to target status is allowed.
 */
export function canTransition(current: DealStatus, target: DealStatus): boolean {
  return TRANSITIONS[current]?.includes(target) ?? false
}

/**
 * Get all allowed next statuses from the current status.
 */
export function getAllowedTransitions(current: DealStatus): DealStatus[] {
  return TRANSITIONS[current] || []
}

/**
 * Transition a deal to a new status with precondition checks.
 */
export async function transitionDealStatus(
  vehicleId: string,
  targetStatus: DealStatus,
  userId: string,
  options?: { reason?: string; force?: boolean }
): Promise<void> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      inspectionAuthorisation: true,
      ddChecklist: true,
      billOfSale: true,
    },
  })

  if (!vehicle) {
    throw new WorkflowError('Vehicle not found')
  }

  const currentStatus = (vehicle as Record<string, unknown>).dealStatus as DealStatus || 'SOURCED'

  // Check transition is allowed (unless forced by admin)
  if (!options?.force && !canTransition(currentStatus, targetStatus)) {
    throw new WorkflowError(
      `Cannot transition from ${currentStatus} to ${targetStatus}. Allowed: ${getAllowedTransitions(currentStatus).join(', ') || 'none (terminal state)'}`
    )
  }

  // Precondition checks per target status
  switch (targetStatus) {
    case 'CONTRACT_SIGNED':
      // Bill of Sale must be signed
      if (vehicle.billOfSale?.status !== 'SIGNED') {
        throw new WorkflowError('Bill of Sale must be signed before moving to CONTRACT_SIGNED')
      }
      break

    case 'COMMITTED':
      // Inspection authorisation must be signed
      if (vehicle.inspectionAuthorisation?.status !== 'SIGNED') {
        throw new WorkflowError('Inspection Authorisation must be signed before moving to COMMITTED')
      }
      break

    case 'APPROVED_FOR_PAYMENT':
      // Inspection must have passed
      if (!(vehicle as Record<string, unknown>).inspectionPassed) {
        throw new WorkflowError('Inspection must pass before deal can be approved for payment')
      }
      break

    case 'PAYMENT_READY':
      // DD Checklist stage 2 must be approved
      if (!vehicle.ddChecklist?.stage2ApprovedAt) {
        throw new WorkflowError('DD Checklist must be fully approved (both stages) before PAYMENT_READY')
      }
      break
  }

  // Perform the transition
  const updateData: Record<string, unknown> = {
    dealStatus: targetStatus,
  }

  // Set timestamps for specific transitions
  switch (targetStatus) {
    case 'CONTRACT_SIGNED':
      updateData.contractSignedAt = new Date()
      break
    case 'PAID':
      updateData.paidAt = new Date()
      break
    case 'SOLD':
      updateData.soldAt = new Date()
      break
    case 'CLOSED':
      updateData.closedAt = new Date()
      break
    case 'CANCELLED_DD_FAIL':
    case 'CANCELLED_INSPECTION_FAIL':
      updateData.cancelledAt = new Date()
      updateData.cancelReason = options?.reason || targetStatus
      break
  }

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: updateData as Prisma.VehicleUpdateInput,
  })

  await logAudit({
    vehicleId,
    userId,
    action: 'DEAL_STATUS_CHANGED',
    details: {
      from: currentStatus,
      to: targetStatus,
      reason: options?.reason,
    } as Prisma.InputJsonValue,
  })
}

/**
 * Calculate spotter fee for a deal.
 * Formula: Net Profit = Resale − Cost − All Expenses − $250 Load Fee
 * Spotter Fee = Rate (25% or 50%) × Net Profit
 */
export async function calculateSpotterFee(vehicleId: string): Promise<{
  netProfitCents: number
  feeAmountCents: number
  ratePercent: number
  resalePriceCents: number
  costPriceCents: number
  totalExpensesCents: number
  loadFeeCents: number
}> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: { expenses: true },
  })

  if (!vehicle) throw new WorkflowError('Vehicle not found')

  const resalePriceCents = (vehicle as Record<string, unknown>).resalePriceCents as number || 0
  const costPriceCents = Math.round((vehicle.purchasePrice || vehicle.sellerPrice || 0) * 100)
  const loadFeeCents = (vehicle as Record<string, unknown>).loadFeeCents as number || 25000
  const totalExpensesCents = vehicle.expenses.reduce((sum, e) => sum + e.amountCents, 0)

  const netProfitCents = resalePriceCents - costPriceCents - totalExpensesCents - loadFeeCents

  // Get sales user's commission rate
  const salesUserId = (vehicle as Record<string, unknown>).assignedSalesUserId as string
  let ratePercent = 25 // default

  if (salesUserId) {
    const rate = await prisma.commissionRate.findFirst({
      where: {
        userId: salesUserId,
        effectiveFrom: { lte: new Date() },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date() } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    })
    if (rate) ratePercent = rate.ratePercent
  }

  const feeAmountCents = Math.round(netProfitCents * (ratePercent / 100))

  return {
    netProfitCents,
    feeAmountCents,
    ratePercent,
    resalePriceCents,
    costPriceCents,
    totalExpensesCents,
    loadFeeCents,
  }
}

/**
 * Create or update the Division 66 GST register entry for a vehicle.
 * Called when deal reaches PAID status and seller is not GST-registered.
 */
export async function createGstRegisterEntry(
  vehicleId: string,
  sellerName: string,
  purchasePriceCents: number,
  sellerAbn?: string | null,
  sellerGstRegistered?: boolean
): Promise<void> {
  // Only create entry if seller is NOT GST-registered (Division 66 applies)
  if (sellerGstRegistered) return

  const now = new Date()
  const quarter = Math.ceil((now.getMonth() + 1) / 3)

  await prisma.gSTRegisterEntry.create({
    data: {
      vehicleId,
      acquisitionDate: now,
      sellerName,
      sellerAbn: sellerAbn || null,
      sellerGstRegistered: false,
      purchasePriceCents,
      basQuarter: `Q${quarter}`,
      basYear: now.getFullYear(),
    },
  })
}
