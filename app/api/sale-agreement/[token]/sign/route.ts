import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ token: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const body = await request.json()
    const { signature } = body

    if (!signature) {
      return NextResponse.json(
        { error: 'Signature is required.' },
        { status: 400 }
      )
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { saleAgreementToken: token },
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Sale agreement not found or link is invalid.' },
        { status: 404 }
      )
    }

    if (vehicle.saleAgreementStatus === 'SIGNED') {
      return NextResponse.json(
        { error: 'This agreement has already been signed.' },
        { status: 400 }
      )
    }

    await prisma.vehicle.update({
      where: { saleAgreementToken: token },
      data: {
        saleAgreementSignature: signature,
        saleAgreementSignedAt: new Date(),
        saleAgreementStatus: 'SIGNED',
      },
    })

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

    await logAudit({
      vehicleId: vehicle.id,
      action: 'SALE_AGREEMENT_SIGNED',
      details: {
        sellerName: vehicle.sellerName,
        sellerEmail: vehicle.sellerEmail,
        signedAt: new Date().toISOString(),
      },
      ipAddress: ip,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[SALE_AGREEMENT_SIGN] Error:', error)
    return NextResponse.json(
      { error: 'Failed to sign sale agreement.' },
      { status: 500 }
    )
  }
}
