import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { sendInvoiceEmail } from '@/lib/mailer'
import { Prisma } from '@prisma/client'
import { format } from 'date-fns'

interface RouteParams {
  params: Promise<{ id: string; invoiceId: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, invoiceId } = await params
    const userId = (session.user as Record<string, unknown>).id as string

    let body: { toEmail?: string } = {}
    try {
      body = await request.json()
    } catch {
      // optional
    }

    const invoice = await prisma.applicationInvoice.findFirst({
      where: { id: invoiceId, vehicleId: id },
    })

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 })
    }

    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
    const dealershipName = settings?.dealershipName || 'Direct Auto Wholesale'
    const contactEmail = settings?.contactEmail || undefined

    const toEmail = body.toEmail || invoice.buyerEmail

    // Generate PDF
    const pdfBuffer = await generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: format(invoice.createdAt, 'dd/MM/yyyy'),
      buyerName: invoice.buyerName,
      buyerEmail: invoice.buyerEmail,
      buyerAddress: invoice.buyerAddress,
      vehicleDescription: invoice.vehicleDescription,
      subtotalCents: invoice.subtotalCents,
      gstCents: invoice.gstCents,
      totalCents: invoice.totalCents,
    })

    const pdfFilename = `${invoice.invoiceNumber}.pdf`

    // Send email with PDF attachment
    await sendInvoiceEmail({
      to: toEmail,
      buyerName: invoice.buyerName,
      invoiceNumber: invoice.invoiceNumber,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      totalCents: invoice.totalCents,
      dealershipName,
      contactEmail,
      pdfBuffer,
      pdfFilename,
    })

    // Update invoice record
    const updated = await prisma.applicationInvoice.update({
      where: { id: invoiceId },
      data: {
        sentAt: new Date(),
        sentToEmail: toEmail,
      },
    })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'INVOICE_SENT',
      details: {
        invoiceNumber: invoice.invoiceNumber,
        sentTo: toEmail,
      } as Prisma.InputJsonValue,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[INVOICE_SEND] Error:', error)
    return NextResponse.json({ error: 'Failed to send invoice.' }, { status: 500 })
  }
}
