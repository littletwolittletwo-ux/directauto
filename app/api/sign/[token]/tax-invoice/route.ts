import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateTaxInvoicePdf } from '@/lib/tax-invoice-pdf'

interface RouteParams {
  params: Promise<{ token: string }>
}

// GET: Public tax invoice PDF download by signing token (no auth required)
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params

    const agreement = await prisma.saleAgreement.findUnique({
      where: { signingToken: token },
      include: { vehicle: { select: { id: true, isCompanyVehicle: true } } },
    })

    if (!agreement) {
      return NextResponse.json({ error: 'Invalid signing link.' }, { status: 404 })
    }

    if (agreement.status !== 'SIGNED') {
      return NextResponse.json(
        { error: 'Agreement has not been signed yet.' },
        { status: 400 }
      )
    }

    if (!agreement.vehicle.isCompanyVehicle) {
      return NextResponse.json(
        { error: 'No tax invoice available for this agreement.' },
        { status: 400 }
      )
    }

    const pdfBuffer = await generateTaxInvoicePdf(agreement.vehicleId)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Tax-Invoice.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[TAX-INVOICE] Download error:', err)
    return NextResponse.json(
      { error: 'Failed to generate tax invoice' },
      { status: 500 }
    )
  }
}
