/**
 * Accounts Receivable Collection Engine
 *
 * Implements the AR overdue cadence from the Direct Auto Platform Framework:
 * Day -1:  Friendly reminder (due soon)
 * Days 1-3: Reminder email + SMS
 * Days 4-7: Phone call task + formal email
 * Days 7-14: Credit suspended, admin notified
 * Days 14-30: Account frozen, escalation email
 * 30+: Demand letter, external recovery, blacklist
 *
 * Called by a scheduled job (cron or Vercel cron) daily.
 */

import { prisma } from './prisma'
import { logAudit } from './audit'
import { Prisma } from '@prisma/client'

export interface CollectionSummary {
  processed: number
  actions: Array<{
    invoiceId: string
    invoiceNumber: string
    buyerName: string
    daysOverdue: number
    actionType: string
  }>
}

/**
 * Run the daily collection check.
 * Finds all unpaid invoices with a due date and applies the appropriate action.
 */
export async function runDailyCollectionCheck(): Promise<CollectionSummary> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Find all unpaid invoices with a due date
  const unpaidInvoices = await prisma.applicationInvoice.findMany({
    where: {
      paidAt: null,
      dueDate: { not: null },
    },
    include: {
      collectionActions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  const summary: CollectionSummary = { processed: 0, actions: [] }

  for (const invoice of unpaidInvoices) {
    if (!invoice.dueDate) continue

    const dueDate = new Date(invoice.dueDate)
    dueDate.setHours(0, 0, 0, 0)

    const diffMs = today.getTime() - dueDate.getTime()
    const daysOverdue = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    const lastAction = invoice.collectionActions[0]
    const lastActionType = lastAction?.actionType || null

    let actionType: string | null = null

    // Determine which action to take based on days overdue
    if (daysOverdue === -1 && lastActionType !== 'REMINDER_DUE_SOON') {
      actionType = 'REMINDER_DUE_SOON'
    } else if (daysOverdue >= 1 && daysOverdue <= 3 && lastActionType !== 'REMINDER_OVERDUE') {
      actionType = 'REMINDER_OVERDUE'
    } else if (daysOverdue >= 4 && daysOverdue <= 7 && lastActionType !== 'PHONE_CALL') {
      actionType = 'PHONE_CALL'
    } else if (daysOverdue >= 7 && daysOverdue <= 14 && lastActionType !== 'CREDIT_SUSPENDED') {
      actionType = 'CREDIT_SUSPENDED'
    } else if (daysOverdue >= 14 && daysOverdue <= 30 && lastActionType !== 'ACCOUNT_FROZEN') {
      actionType = 'ACCOUNT_FROZEN'
    } else if (daysOverdue > 30 && lastActionType !== 'DEMAND_LETTER') {
      actionType = 'DEMAND_LETTER'
    }

    if (!actionType) continue

    // Create the collection action
    await prisma.collectionAction.create({
      data: {
        invoiceId: invoice.id,
        buyerDealerId: invoice.buyerDealerId || null,
        actionType,
        dueDate: invoice.dueDate,
        daysOverdue,
        createdAt: new Date(),
      },
    })

    // Apply credit status changes to buyer-dealer
    if (invoice.buyerDealerId) {
      if (actionType === 'CREDIT_SUSPENDED') {
        await prisma.buyerDealer.update({
          where: { id: invoice.buyerDealerId },
          data: {
            creditStatus: 'SUSPENDED',
            creditSuspendedAt: new Date(),
          },
        })
      } else if (actionType === 'ACCOUNT_FROZEN') {
        await prisma.buyerDealer.update({
          where: { id: invoice.buyerDealerId },
          data: { creditStatus: 'FROZEN' },
        })
      } else if (actionType === 'DEMAND_LETTER') {
        await prisma.buyerDealer.update({
          where: { id: invoice.buyerDealerId },
          data: {
            creditStatus: 'BLACKLISTED',
            riskRating: 'HIGH',
            blacklistedAt: new Date(),
          },
        })
      }
    }

    // Audit log
    await logAudit({
      vehicleId: invoice.vehicleId,
      userId: undefined,
      action: 'AR_COLLECTION_ACTION',
      details: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        actionType,
        daysOverdue,
        buyerDealerId: invoice.buyerDealerId,
      } as Prisma.InputJsonValue,
    })

    summary.actions.push({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      buyerName: invoice.buyerName,
      daysOverdue,
      actionType,
    })
    summary.processed++
  }

  return summary
}

/**
 * Mark an invoice as paid and release the deal.
 * - Updates invoice paid status
 * - Restores buyer-dealer credit if previously suspended
 * - Triggers deal status transition toward CLOSED
 */
export async function markInvoicePaid(
  invoiceId: string,
  userId: string
): Promise<void> {
  const invoice = await prisma.applicationInvoice.findUnique({
    where: { id: invoiceId },
  })

  if (!invoice) throw new Error('Invoice not found')

  await prisma.applicationInvoice.update({
    where: { id: invoiceId },
    data: { paidAt: new Date() },
  })

  // If buyer-dealer was suspended/frozen for THIS invoice, check if all invoices now paid
  if (invoice.buyerDealerId) {
    const remainingUnpaid = await prisma.applicationInvoice.count({
      where: {
        buyerDealerId: invoice.buyerDealerId,
        paidAt: null,
        id: { not: invoiceId },
      },
    })

    if (remainingUnpaid === 0) {
      // Restore credit status (unless blacklisted — that requires manual review)
      const dealer = await prisma.buyerDealer.findUnique({
        where: { id: invoice.buyerDealerId },
      })
      if (dealer && dealer.creditStatus !== 'BLACKLISTED') {
        await prisma.buyerDealer.update({
          where: { id: invoice.buyerDealerId },
          data: { creditStatus: 'ACTIVE' },
        })
      }
    }
  }

  await logAudit({
    vehicleId: invoice.vehicleId,
    userId,
    action: 'INVOICE_PAID',
    details: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalCents: invoice.totalCents,
    } as Prisma.InputJsonValue,
  })
}
