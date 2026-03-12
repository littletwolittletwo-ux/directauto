import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ token: string }>
}

// GET: Fetch agreement details by signing token (public, no auth)
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params

    const agreement = await prisma.saleAgreement.findUnique({
      where: { signingToken: token },
      include: {
        vehicle: {
          include: {
            identity: {
              select: { fullLegalName: true },
            },
            ppsrCheck: {
              select: {
                isWrittenOff: true,
                isStolen: true,
                hasFinance: true,
                checkedAt: true,
              },
            },
          },
        },
      },
    })

    if (!agreement) {
      return NextResponse.json({ error: 'Invalid signing link.' }, { status: 404 })
    }

    if (agreement.status === 'SIGNED') {
      return NextResponse.json({
        status: 'SIGNED',
        signerName: agreement.signerName,
        signedAt: agreement.signedAt,
        vehicle: {
          make: agreement.vehicle.make,
          model: agreement.vehicle.model,
          year: agreement.vehicle.year,
          confirmationNumber: agreement.vehicle.confirmationNumber,
        },
        salePrice: agreement.salePrice,
      }, { status: 200 })
    }

    // Return agreement details for signing (no sensitive data)
    return NextResponse.json({
      status: agreement.status,
      salePrice: agreement.salePrice,
      buyerName: agreement.buyerName,
      buyerEmail: agreement.buyerEmail,
      agreementDate: agreement.agreementDate,
      vehicle: {
        make: agreement.vehicle.make,
        model: agreement.vehicle.model,
        year: agreement.vehicle.year,
        vin: agreement.vehicle.vin,
        registrationNumber: agreement.vehicle.registrationNumber,
        odometer: agreement.vehicle.odometer,
        confirmationNumber: agreement.vehicle.confirmationNumber,
        sellerName: agreement.vehicle.identity?.fullLegalName || agreement.vehicle.sellerName,
      },
      ppsr: agreement.vehicle.ppsrCheck
        ? {
            isWrittenOff: agreement.vehicle.ppsrCheck.isWrittenOff,
            isStolen: agreement.vehicle.ppsrCheck.isStolen,
            hasFinance: agreement.vehicle.ppsrCheck.hasFinance,
            checkedAt: agreement.vehicle.ppsrCheck.checkedAt,
          }
        : null,
    })
  } catch (err) {
    console.error('[SIGN] GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST: Submit signature (public, no auth)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const body = await request.json()
    const { signerName } = body

    if (!signerName || typeof signerName !== 'string' || signerName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Please provide your full legal name.' },
        { status: 400 }
      )
    }

    const agreement = await prisma.saleAgreement.findUnique({
      where: { signingToken: token },
      include: { vehicle: true },
    })

    if (!agreement) {
      return NextResponse.json({ error: 'Invalid signing link.' }, { status: 404 })
    }

    if (agreement.status === 'SIGNED') {
      return NextResponse.json({ error: 'This agreement has already been signed.' }, { status: 410 })
    }

    // Get signer IP
    const forwarded = request.headers.get('x-forwarded-for')
    const signerIp = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'

    // Update agreement
    const updated = await prisma.saleAgreement.update({
      where: { signingToken: token },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
        signerName: signerName.trim(),
        signerIp,
      },
    })

    await logAudit({
      vehicleId: agreement.vehicleId,
      action: 'SALE_AGREEMENT_SIGNED',
      details: {
        signerName: signerName.trim(),
        signerIp,
        salePrice: agreement.salePrice,
      },
    })

    return NextResponse.json({
      success: true,
      confirmationNumber: agreement.vehicle.confirmationNumber,
      signedAt: updated.signedAt,
      pdfUrl: `/api/sign/${token}/pdf`,
    })
  } catch (err) {
    console.error('[SIGN] POST error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
