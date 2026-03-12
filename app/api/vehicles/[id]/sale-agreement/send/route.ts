import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { generateSaleAgreementPdf } from '@/lib/sale-agreement-pdf'
import { sendSaleAgreementEmail } from '@/lib/mailer'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST: Generate PDF and email sale agreement to buyer
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userId = (session.user as Record<string, unknown>).id as string

    // Fetch vehicle with sale agreement
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: { saleAgreement: true },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 })
    }
    if (!vehicle.saleAgreement) {
      return NextResponse.json(
        { error: 'No sale agreement exists for this vehicle.' },
        { status: 400 }
      )
    }

    // Generate PDF
    const pdfBuffer = await generateSaleAgreementPdf(id)

    // Get settings for email template
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    })
    const dealershipName = settings?.dealershipName || 'Direct Auto Wholesale'

    // Send email with PDF attachment
    await sendSaleAgreementEmail({
      to: vehicle.saleAgreement.buyerEmail,
      buyerName: vehicle.saleAgreement.buyerName,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      salePrice: vehicle.saleAgreement.salePrice,
      dealershipName,
      contactEmail: settings?.contactEmail || undefined,
      pdfBuffer,
      pdfFilename: `Sale-Agreement-${vehicle.vin}.pdf`,
    })

    // Update status to SENT
    const updated = await prisma.saleAgreement.update({
      where: { vehicleId: id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        sentById: userId,
      },
    })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'SALE_AGREEMENT_SENT',
      details: {
        sentTo: vehicle.saleAgreement.buyerEmail,
        salePrice: vehicle.saleAgreement.salePrice,
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[SALE-AGREEMENT] Send error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send sale agreement' },
      { status: 500 }
    )
  }
}
