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
      autograbVehicleId,
      autograbTradeValue,
      autograbRetailValue,
      autograbColour,
      autograbEngine,
      autograbTransmission,
      autograbBodyType,
      purchasePrice,
      offerPrice,
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

    const vehicle = await prisma.vehicle.create({
      data: {
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
        autograbVehicleId: autograbVehicleId || null,
        autograbTradeValue: autograbTradeValue ? parseFloat(autograbTradeValue) : null,
        autograbRetailValue: autograbRetailValue ? parseFloat(autograbRetailValue) : null,
        autograbColour: autograbColour || null,
        autograbEngine: autograbEngine || null,
        autograbTransmission: autograbTransmission || null,
        autograbBodyType: autograbBodyType || null,
        purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
        offerPrice: offerPrice ? parseFloat(offerPrice) : null,
        submissionSource: 'STAFF_ENTRY',
        createdById: (session.user as any).id,
        status: 'PENDING_VERIFICATION',
      },
    })

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
