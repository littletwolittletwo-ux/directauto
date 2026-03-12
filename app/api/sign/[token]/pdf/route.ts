import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateSaleAgreementPdf } from '@/lib/sale-agreement-pdf'

interface RouteParams {
  params: Promise<{ token: string }>
}

// GET: Public PDF download by signing token (no auth required)
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params

    const agreement = await prisma.saleAgreement.findUnique({
      where: { signingToken: token },
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

    const pdfBuffer = await generateSaleAgreementPdf(agreement.vehicleId)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Sale-Agreement-Signed.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[SIGN-PDF] Download error:', err)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
