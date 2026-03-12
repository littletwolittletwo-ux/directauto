import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST: Generate signing link and mark agreement as SENT
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

    // Ensure signing token exists (generate if missing from older records)
    const signingToken = vehicle.saleAgreement.signingToken || crypto.randomUUID()

    // Update status to SENT
    const updated = await prisma.saleAgreement.update({
      where: { vehicleId: id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        sentById: userId,
        signingToken,
      },
    })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'SALE_AGREEMENT_SENT',
      details: {
        buyerEmail: vehicle.saleAgreement.buyerEmail,
        salePrice: vehicle.saleAgreement.salePrice,
      },
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'https://directauto.vercel.app'
    const signingLink = `${baseUrl}/sign/${signingToken}`

    return NextResponse.json({ agreement: updated, signingLink })
  } catch (err) {
    console.error('[SALE-AGREEMENT] Send error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate signing link' },
      { status: 500 }
    )
  }
}
