import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    console.log('[VEHICLES_GET] Session:', session ? `user=${(session.user as Record<string, unknown>)?.email}` : 'NULL')
    if (!session) {
      console.log('[VEHICLES_GET] Returning 401 — no session. Cookies:', request.headers.get('cookie')?.split(';').map(c => c.trim().split('=')[0]).join(', '))
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const riskLevel = searchParams.get('riskLevel')
    const search = searchParams.get('search')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const sortBy = searchParams.get('sortBy') || 'submittedAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build where clause
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (source) {
      where.submissionSource = source
    }

    if (riskLevel) {
      switch (riskLevel) {
        case 'low':
          where.riskScore = { lte: 20 }
          break
        case 'medium':
          where.riskScore = { gt: 20, lte: 50 }
          break
        case 'high':
          where.riskScore = { gt: 50 }
          break
      }
    }

    if (search) {
      where.OR = [
        { vin: { contains: search, mode: 'insensitive' } },
        { registrationNumber: { contains: search, mode: 'insensitive' } },
        { sellerName: { contains: search, mode: 'insensitive' } },
        { confirmationNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (dateFrom || dateTo) {
      where.submittedAt = {} as any
      if (dateFrom) {
        where.submittedAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.submittedAt.lte = new Date(dateTo)
      }
    }

    // Validate sortBy against allowed columns
    const allowedSortColumns = [
      'submittedAt',
      'confirmationNumber',
      'vin',
      'make',
      'model',
      'year',
      'sellerName',
      'status',
      'riskScore',
    ]
    const validSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'submittedAt'
    const validSortOrder = sortOrder === 'asc' ? 'asc' : 'desc'

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        orderBy: { [validSortBy]: validSortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          identity: {
            select: {
              fullLegalName: true,
              driversLicenceNumber: true,
            },
          },
          _count: {
            select: { documents: true },
          },
        },
      }),
      prisma.vehicle.count({ where }),
    ])

    return NextResponse.json({
      vehicles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[VEHICLES_GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vehicles.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const {
      vin,
      registrationNumber,
      make,
      model,
      year,
      odometer,
      sellerName,
      sellerPhone,
      sellerEmail,
      sellerPrice,
      location,
    } = body

    // Validate required fields
    if (!vin || !registrationNumber || !make || !model || !year || !odometer || !sellerName || !sellerPhone || !sellerEmail) {
      return NextResponse.json(
        { error: 'Missing required fields.' },
        { status: 400 }
      )
    }

    // Generate confirmation number
    const currentYear = new Date().getFullYear()
    const prefix = `VEH-${currentYear}-`
    const count = await prisma.vehicle.count({
      where: {
        confirmationNumber: { startsWith: prefix },
      },
    })
    const confirmationNumber = `${prefix}${(count + 1).toString().padStart(4, '0')}`

    // Base data — only fields guaranteed to exist in the database
    const createData: any = {
      confirmationNumber,
      vin: vin.toUpperCase(),
      registrationNumber,
      make,
      model,
      year: parseInt(year, 10),
      odometer: parseInt(odometer, 10),
      sellerName,
      sellerPhone,
      sellerEmail,
      sellerPrice: sellerPrice ? parseFloat(sellerPrice) : null,
      location: location || null,
      submissionSource: 'STAFF_ENTRY',
      createdById: (session.user as any).id,
      status: 'PENDING_VERIFICATION',
    }

    // Try to create with base fields first
    let vehicle
    try {
      vehicle = await prisma.vehicle.create({ data: createData })
    } catch (baseErr: any) {
      // If even base create fails (e.g. createdById column missing), retry without it
      if (baseErr?.message?.includes('does not exist')) {
        delete createData.createdById
        vehicle = await prisma.vehicle.create({ data: createData })
      } else {
        throw baseErr
      }
    }

    // Try to add extended fields via update (non-fatal)
    const extendedData: Record<string, unknown> = {}
    if (body.autograbVehicleId) extendedData.autograbVehicleId = body.autograbVehicleId
    if (body.autograbTradeValue) extendedData.autograbTradeValue = parseFloat(body.autograbTradeValue)
    if (body.autograbRetailValue) extendedData.autograbRetailValue = parseFloat(body.autograbRetailValue)
    if (body.autograbColour) extendedData.autograbColour = body.autograbColour
    if (body.autograbEngine) extendedData.autograbEngine = body.autograbEngine
    if (body.autograbTransmission) extendedData.autograbTransmission = body.autograbTransmission
    if (body.autograbBodyType) extendedData.autograbBodyType = body.autograbBodyType
    if (body.purchasePrice) extendedData.purchasePrice = parseFloat(body.purchasePrice)
    if (body.offerPrice) extendedData.offerPrice = parseFloat(body.offerPrice)

    if (Object.keys(extendedData).length > 0) {
      try {
        vehicle = await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: extendedData as any,
        })
      } catch (extErr) {
        console.warn('[VEHICLES_POST] Extended fields skipped (columns may not exist):', extErr instanceof Error ? extErr.message.slice(0, 200) : extErr)
      }
    }

    await logAudit({
      vehicleId: vehicle.id,
      userId: (session.user as any).id,
      action: 'VEHICLE_SUBMITTED',
      details: {
        source: 'STAFF_ENTRY',
        confirmationNumber,
      } as Prisma.InputJsonValue,
    })

    return NextResponse.json(vehicle, { status: 201 })
  } catch (error) {
    console.error('[VEHICLES_POST] Error:', error)

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A vehicle with this VIN already exists.' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create vehicle.' },
      { status: 500 }
    )
  }
}
