import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: {
        identity: true,
        ownership: true,
        ppsrCheck: true,
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found.' },
        { status: 404 }
      )
    }

    return NextResponse.json(vehicle)
  } catch (error) {
    console.error('[VEHICLE_GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vehicle.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify vehicle exists
    const existing = await prisma.vehicle.findUnique({
      where: { id },
    })
    if (!existing) {
      return NextResponse.json(
        { error: 'Vehicle not found.' },
        { status: 404 }
      )
    }

    const body = await request.json()

    // Fields that can be updated
    const allowedFields = [
      'sellerPrice',
      'location',
      'status',
      'sellerName',
      'sellerPhone',
      'sellerEmail',
      'registrationNumber',
      'make',
      'model',
      'year',
      'odometer',
    ]

    const updateData: Record<string, unknown> = {}
    const changes: Record<string, { from: unknown; to: unknown }> = {}

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const oldValue = (existing as Record<string, unknown>)[field]
        let newValue = body[field]

        // Type coerce numeric fields
        if (field === 'year' || field === 'odometer') {
          newValue = parseInt(newValue, 10)
        } else if (field === 'sellerPrice') {
          newValue = newValue !== null ? parseFloat(newValue) : null
        }

        updateData[field] = newValue
        changes[field] = { from: oldValue, to: newValue }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update.' },
        { status: 400 }
      )
    }

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: updateData,
    })

    await logAudit({
      vehicleId: id,
      userId: (session.user as Record<string, unknown>).id as string,
      action: 'VEHICLE_UPDATED',
      details: changes as Prisma.InputJsonValue,
    })

    return NextResponse.json(vehicle)
  } catch (error) {
    console.error('[VEHICLE_PATCH] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update vehicle.' },
      { status: 500 }
    )
  }
}
