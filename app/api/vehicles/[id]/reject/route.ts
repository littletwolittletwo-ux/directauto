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

    // Require ADMIN role
    if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    const { id } = await params

    const body = await request.json()
    const { reason } = body

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json(
        { error: 'A rejection reason is required.' },
        { status: 400 }
      )
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found.' },
        { status: 404 }
      )
    }

    // Append reason to existing adminNotes array
    const existingNotes = Array.isArray(vehicle.adminNotes)
      ? (vehicle.adminNotes as string[])
      : []
    const updatedNotes = [
      ...existingNotes,
      `[REJECTED ${new Date().toISOString()}] ${reason.trim()}`,
    ]

    const updatedVehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        status: 'REJECTED',
        adminNotes: updatedNotes as Prisma.InputJsonValue,
      },
    })

    await logAudit({
      vehicleId: id,
      userId: (session.user as Record<string, unknown>).id as string,
      action: 'VEHICLE_REJECTED',
      details: {
        reason: reason.trim(),
        previousStatus: vehicle.status,
      } as Prisma.InputJsonValue,
    })

    return NextResponse.json(updatedVehicle)
  } catch (error) {
    console.error('[VEHICLE_REJECT] Error:', error)
    return NextResponse.json(
      { error: 'Failed to reject vehicle.' },
      { status: 500 }
    )
  }
}
