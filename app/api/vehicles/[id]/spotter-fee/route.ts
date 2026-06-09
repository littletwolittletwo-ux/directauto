import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateSpotterFee } from '@/lib/deal-workflow'
import { Prisma } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/vehicles/[id]/spotter-fee
 * Calculate (or retrieve locked) spotter fee for a deal.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // Check for existing locked fee
    const existing = await prisma.spotterFee.findUnique({ where: { vehicleId: id } })
    if (existing) {
      return NextResponse.json(existing)
    }

    // Calculate live
    const calculation = await calculateSpotterFee(id)
    return NextResponse.json({ ...calculation, locked: false })
  } catch (error) {
    console.error('[SPOTTER_FEE_GET] Error:', error)
    return NextResponse.json({ error: 'Failed to calculate spotter fee' }, { status: 500 })
  }
}

/**
 * POST /api/vehicles/[id]/spotter-fee
 * Lock the spotter fee calculation (at AR invoice issue).
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })

    const salesUserId = (vehicle as Record<string, unknown>).assignedSalesUserId as string
    if (!salesUserId) {
      return NextResponse.json({ error: 'No sales user assigned to this deal' }, { status: 400 })
    }

    const calc = await calculateSpotterFee(id)

    const fee = await prisma.spotterFee.upsert({
      where: { vehicleId: id },
      create: {
        vehicleId: id,
        salesUserId,
        ratePercent: calc.ratePercent,
        resalePriceCents: calc.resalePriceCents,
        costPriceCents: calc.costPriceCents,
        totalExpensesCents: calc.totalExpensesCents,
        loadFeeCents: calc.loadFeeCents,
        netProfitCents: calc.netProfitCents,
        feeAmountCents: calc.feeAmountCents,
        lockedAt: new Date(),
      },
      update: {
        ratePercent: calc.ratePercent,
        resalePriceCents: calc.resalePriceCents,
        costPriceCents: calc.costPriceCents,
        totalExpensesCents: calc.totalExpensesCents,
        loadFeeCents: calc.loadFeeCents,
        netProfitCents: calc.netProfitCents,
        feeAmountCents: calc.feeAmountCents,
        lockedAt: new Date(),
        adjustmentNotes: 'Recalculated on lock',
      } as Prisma.SpotterFeeUpdateInput,
    })

    return NextResponse.json(fee)
  } catch (error) {
    console.error('[SPOTTER_FEE_POST] Error:', error)
    return NextResponse.json({ error: 'Failed to lock spotter fee' }, { status: 500 })
  }
}
