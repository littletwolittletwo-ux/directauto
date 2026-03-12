import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET: Fetch existing sale agreement for a vehicle
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const agreement = await prisma.saleAgreement.findUnique({
      where: { vehicleId: id },
    })

    return NextResponse.json(agreement)
  } catch (err) {
    console.error('[SALE-AGREEMENT] GET error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch sale agreement' },
      { status: 500 }
    )
  }
}

// POST: Create or update sale agreement (upsert)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userId = (session.user as Record<string, unknown>).id as string
    const body = await request.json()

    const { salePrice, buyerName, buyerEmail, buyerPhone, buyerAddress, notes, status } = body

    // Allow marking as signed via status update
    if (status === 'SIGNED') {
      const existing = await prisma.saleAgreement.findUnique({
        where: { vehicleId: id },
      })
      if (!existing) {
        return NextResponse.json({ error: 'No sale agreement exists.' }, { status: 404 })
      }
      const updated = await prisma.saleAgreement.update({
        where: { vehicleId: id },
        data: { status: 'SIGNED' },
      })
      await logAudit({
        vehicleId: id,
        userId,
        action: 'SALE_AGREEMENT_SIGNED',
        details: { markedBy: userId },
      })
      return NextResponse.json(updated)
    }

    // Validate required fields for create/update
    if (!salePrice || !buyerName || !buyerEmail) {
      return NextResponse.json(
        { error: 'Sale price, buyer name, and buyer email are required.' },
        { status: 400 }
      )
    }

    // Verify vehicle exists
    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 })
    }

    // Upsert the agreement — generate signing token on create
    const signingToken = crypto.randomUUID()
    const agreement = await prisma.saleAgreement.upsert({
      where: { vehicleId: id },
      create: {
        vehicleId: id,
        salePrice: parseFloat(String(salePrice)),
        buyerName,
        buyerEmail,
        buyerPhone: buyerPhone || null,
        buyerAddress: buyerAddress || null,
        notes: notes || null,
        status: 'DRAFT',
        signingToken,
      },
      update: {
        salePrice: parseFloat(String(salePrice)),
        buyerName,
        buyerEmail,
        buyerPhone: buyerPhone || null,
        buyerAddress: buyerAddress || null,
        notes: notes || null,
      },
    })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'SALE_AGREEMENT_SAVED',
      details: { salePrice: agreement.salePrice, buyerName, buyerEmail, status: agreement.status },
    })

    return NextResponse.json(agreement)
  } catch (err) {
    console.error('[SALE-AGREEMENT] POST error:', err)
    return NextResponse.json(
      { error: 'Failed to save sale agreement' },
      { status: 500 }
    )
  }
}
