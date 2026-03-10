import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateVehiclePDFHtml } from '@/lib/pdf-generator'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const isSeller = type === 'seller'

    // Auth check: seller summary is public, full report requires auth
    if (!isSeller) {
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const html = await generateVehiclePDFHtml(id, !isSeller)

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[PDF_EXPORT] Error:', error)

    if (error instanceof Error && error.message === 'Vehicle not found') {
      return NextResponse.json(
        { error: 'Vehicle not found.' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate PDF.' },
      { status: 500 }
    )
  }
}
