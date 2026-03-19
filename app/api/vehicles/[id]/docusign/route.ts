import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { createAndSendEnvelope, type BillOfSaleData } from '@/lib/docusign-client'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userId = (session.user as Record<string, unknown>).id as string

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: { identity: true },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    if (!vehicle.purchasePrice) {
      return NextResponse.json({ error: 'Purchase price must be set before sending Bill of Sale' }, { status: 400 })
    }

    // Get settings for ABN
    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })

    const billOfSaleData: BillOfSaleData = {
      sellerName: vehicle.identity?.fullLegalName || vehicle.sellerName,
      sellerAddress: vehicle.identity?.address || '',
      sellerLicenceNumber: vehicle.identity?.driversLicenceNumber || '',
      buyerName: settings?.dealershipName || 'Direct Auto Wholesale',
      buyerAddress: '697 Burke Road Camberwell VIC 3124',
      buyerAbn: settings?.abn || undefined,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      vehicleYear: vehicle.year,
      vehicleVin: vehicle.vin,
      vehicleRego: vehicle.registrationNumber,
      vehicleOdometer: vehicle.odometer,
      vehicleColour: vehicle.autograbColour || undefined,
      vehicleTransmission: vehicle.autograbTransmission || undefined,
      purchasePrice: vehicle.purchasePrice,
      sellerEmail: vehicle.sellerEmail,
      date: new Date().toLocaleDateString('en-AU'),
    }

    const envelopeId = await createAndSendEnvelope(billOfSaleData)

    await prisma.vehicle.update({
      where: { id },
      data: {
        docusignEnvelopeId: envelopeId,
        docusignStatus: 'SENT',
      },
    })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'DOCUSIGN_SENT',
      details: { envelopeId, sellerEmail: vehicle.sellerEmail } as Prisma.InputJsonValue,
    })

    return NextResponse.json({ envelopeId, status: 'SENT' })
  } catch (error) {
    console.error('[DOCUSIGN] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to send DocuSign envelope'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
