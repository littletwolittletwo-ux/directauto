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

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found.' },
        { status: 404 }
      )
    }

    const updatedVehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        status: 'APPROVED',
      },
    })

    await logAudit({
      vehicleId: id,
      userId: (session.user as Record<string, unknown>).id as string,
      action: 'VEHICLE_APPROVED',
      details: {
        previousStatus: vehicle.status,
      } as Prisma.InputJsonValue,
    })

    return NextResponse.json(updatedVehicle)
  } catch (error) {
    console.error('[VEHICLE_APPROVE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to approve vehicle.' },
      { status: 500 }
    )
  }
}
