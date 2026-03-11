import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ token: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params

    const vehicle = await prisma.vehicle.findUnique({
      where: { saleAgreementToken: token },
      include: {
        identity: true,
      },
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Sale agreement not found or link is invalid.' },
        { status: 404 }
      )
    }

    if (vehicle.saleAgreementStatus === 'SIGNED') {
      return NextResponse.json(
        { error: 'This agreement has already been signed.', signed: true },
        { status: 400 }
      )
    }

    return NextResponse.json({
      id: vehicle.id,
      sellerName: vehicle.sellerName,
      sellerEmail: vehicle.sellerEmail,
      sellerPhone: vehicle.sellerPhone,
      vin: vehicle.vin,
      registrationNumber: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      odometer: vehicle.odometer,
      purchasePrice: vehicle.purchasePrice,
      saleAgreementStatus: vehicle.saleAgreementStatus,
      identity: vehicle.identity ? {
        fullLegalName: vehicle.identity.fullLegalName,
        address: vehicle.identity.address,
        driversLicenceNumber: vehicle.identity.driversLicenceNumber,
        licenceState: vehicle.identity.licenceState,
      } : null,
    })
  } catch (error) {
    console.error('[SALE_AGREEMENT_GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load sale agreement.' },
      { status: 500 }
    )
  }
}
