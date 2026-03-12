import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateSaleAgreementPdf } from '@/lib/sale-agreement-pdf'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET: Download sale agreement PDF
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const pdfBuffer = await generateSaleAgreementPdf(id)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Sale-Agreement.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate PDF'
    console.error('[SALE-AGREEMENT] Download error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
