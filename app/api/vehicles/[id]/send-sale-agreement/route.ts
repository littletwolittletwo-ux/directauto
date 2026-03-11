import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { sendSaleAgreement } from '@/lib/mailer'
import { v4 as uuidv4 } from 'uuid'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { purchasePrice } = body

    if (!purchasePrice || purchasePrice <= 0) {
      return NextResponse.json(
        { error: 'Valid purchase price is required.' },
        { status: 400 }
      )
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 })
    }

    if (vehicle.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Vehicle must be approved before sending sale agreement.' },
        { status: 400 }
      )
    }

    const token = uuidv4()

    const updatedVehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        purchasePrice: parseFloat(purchasePrice),
        saleAgreementToken: token,
        saleAgreementSentAt: new Date(),
        saleAgreementStatus: 'SENT',
      },
    })

    // Fetch settings for email
    const settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    })

    await sendSaleAgreement({
      to: vehicle.sellerEmail,
      sellerName: vehicle.sellerName,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      token,
      dealershipName: settings?.dealershipName || 'Direct Auto Wholesale',
      contactEmail: settings?.contactEmail || undefined,
    })

    await logAudit({
      vehicleId: id,
      userId: (session.user as Record<string, unknown>).id as string,
      action: 'SALE_AGREEMENT_SENT',
      details: {
        purchasePrice: parseFloat(purchasePrice),
        sellerEmail: vehicle.sellerEmail,
      } as Prisma.InputJsonValue,
    })

    return NextResponse.json(updatedVehicle)
  } catch (error) {
    console.error('[SEND_SALE_AGREEMENT] Error:', error)
    return NextResponse.json(
      { error: 'Failed to send sale agreement.' },
      { status: 500 }
    )
  }
}
