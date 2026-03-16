import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

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

    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    const body = await request.json()
    const { condition, repairCost, notes } = body

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        inspectionCondition: condition || null,
        inspectionRepairCost: repairCost != null ? parseFloat(repairCost) : null,
        inspectionNotes: notes || null,
        inspectedAt: new Date(),
      },
    })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'INSPECTION_UPDATED',
      details: { condition, repairCost, notes } as Prisma.InputJsonValue,
    })

    return NextResponse.json({
      inspectionCondition: updated.inspectionCondition,
      inspectionRepairCost: updated.inspectionRepairCost,
      inspectionNotes: updated.inspectionNotes,
      inspectedAt: updated.inspectedAt,
    })
  } catch (error) {
    console.error('[INSPECTION] Error:', error)
    return NextResponse.json({ error: 'Failed to save inspection' }, { status: 500 })
  }
}
