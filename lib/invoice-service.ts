import { prisma } from './prisma'
import { requireApproved } from './approval'
import { logAudit } from './audit'
import { Prisma } from '@prisma/client'

/**
 * Generate a sequential invoice number in format INV-YYYY-NNNNN
 * Uses a DB-level atomic increment to prevent race conditions.
 */
export async function getNextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()

  const seq = await prisma.invoiceSequence.upsert({
    where: { id: 'singleton' },
    update: { lastNum: { increment: 1 } },
    create: { id: 'singleton', lastNum: 1 },
  })

  const padded = String(seq.lastNum).padStart(5, '0')
  return `INV-${year}-${padded}`
}

interface GenerateInvoiceInput {
  vehicleId: string
  userId: string
  salePrice: number // in dollars
  buyerName: string
  buyerEmail: string
  buyerAddress?: string
}

export async function generateInvoice(input: GenerateInvoiceInput) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: input.vehicleId },
  })

  if (!vehicle) throw new Error('Vehicle not found')

  // Gate on approval
  requireApproved(vehicle as Record<string, unknown>)

  const invoiceNumber = await getNextInvoiceNumber()

  // Snapshot vehicle description
  const vehicleDescription = `${vehicle.year} ${vehicle.make} ${vehicle.model} — VIN: ${vehicle.vin}, Rego: ${vehicle.registrationNumber}`

  // Calculate amounts in cents
  const subtotalCents = Math.round(input.salePrice * 100)
  const gstCents = Math.round(subtotalCents * 0.1) // 10% GST (Australia)
  const totalCents = subtotalCents + gstCents

  const invoice = await prisma.applicationInvoice.create({
    data: {
      vehicleId: input.vehicleId,
      invoiceNumber,
      buyerName: input.buyerName,
      buyerEmail: input.buyerEmail,
      buyerAddress: input.buyerAddress || null,
      vehicleDescription,
      subtotalCents,
      gstCents,
      totalCents,
      createdByUserId: input.userId,
    },
  })

  // Auto-flip stock status to SOLD
  await prisma.vehicle.update({
    where: { id: input.vehicleId },
    data: { stockStatus: 'SOLD', soldAt: new Date(), soldPrice: input.salePrice } as Record<string, unknown>,
  })

  await logAudit({
    vehicleId: input.vehicleId,
    userId: input.userId,
    action: 'INVOICE_GENERATED',
    details: {
      invoiceNumber,
      subtotalCents,
      gstCents,
      totalCents,
      buyerName: input.buyerName,
    } as Prisma.InputJsonValue,
  })

  return invoice
}

export function formatCentsAsDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
