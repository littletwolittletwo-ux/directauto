import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { generateInspectionAuthorisationPdf } from '@/lib/inspection-authorisation-pdf'
import { Prisma } from '@prisma/client'
import crypto from 'crypto'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/vehicles/[id]/inspection-auth
 * Get or create inspection authorisation for a vehicle.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const auth = await prisma.inspectionAuthorisation.findUnique({
      where: { vehicleId: id },
    })

    return NextResponse.json(auth)
  } catch (error) {
    console.error('[INSPECTION_AUTH_GET] Error:', error)
    return NextResponse.json({ error: 'Failed to get inspection authorisation' }, { status: 500 })
  }
}

/**
 * POST /api/vehicles/[id]/inspection-auth
 * Create inspection authorisation and generate signing link.
 * Body: { ownerName, vehicleLocation? }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const userId = (session.user as Record<string, unknown>).id as string
    const body = await request.json()
    const { ownerName, vehicleLocation } = body

    if (!ownerName) {
      return NextResponse.json({ error: 'ownerName is required' }, { status: 400 })
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })

    const signingToken = crypto.randomBytes(32).toString('hex')

    const auth = await prisma.inspectionAuthorisation.upsert({
      where: { vehicleId: id },
      create: {
        vehicleId: id,
        ownerName,
        vehicleLocation,
        status: 'SENT',
        signingToken,
        sentAt: new Date(),
        sentById: userId,
      },
      update: {
        ownerName,
        vehicleLocation,
        status: 'SENT',
        signingToken,
        sentAt: new Date(),
        sentById: userId,
      },
    })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'INSPECTION_AUTH_SENT',
      details: { signingToken: signingToken.slice(0, 8) + '...' } as Prisma.InputJsonValue,
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'https://directauto.vercel.app'
    const signingLink = `${baseUrl}/sign-inspection/${signingToken}`

    return NextResponse.json({ auth, signingLink })
  } catch (error) {
    console.error('[INSPECTION_AUTH_POST] Error:', error)
    return NextResponse.json({ error: 'Failed to create inspection authorisation' }, { status: 500 })
  }
}

/**
 * GET /api/vehicles/[id]/inspection-auth/download
 * Download inspection authorisation PDF.
 */
export async function PUT(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })

    const auth = await prisma.inspectionAuthorisation.findUnique({
      where: { vehicleId: id },
    })

    const pdf = await generateInspectionAuthorisationPdf({
      vin: vehicle.vin,
      registrationNumber: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      colour: vehicle.autograbColour || undefined,
      ownerName: auth?.ownerName || vehicle.sellerName,
      vehicleLocation: auth?.vehicleLocation || undefined,
      isSigned: auth?.status === 'SIGNED',
      signerName: auth?.signerName || undefined,
      signedAt: auth?.signedAt?.toISOString().split('T')[0],
      signerIp: auth?.signerIp || undefined,
    })

    return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="inspection-auth-${vehicle.registrationNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error('[INSPECTION_AUTH_PDF] Error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
