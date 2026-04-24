import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { Prisma } from '@prisma/client'

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

    const toEmail = body.toEmail || invoice.buyerEmail

    // In a full implementation, this would send via nodemailer with PDF attachment
    // For now, record the send action
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
