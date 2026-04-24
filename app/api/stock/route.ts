import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    const make = url.searchParams.get('make')
    const model = url.searchParams.get('model')
    const search = url.searchParams.get('search')
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const where: any = {}

    if (status) {
      const statuses = status.split(',')
      where.stockStatus = { in: statuses }
    }

    if (dateFrom || dateTo) {
      where.submittedAt = {}
      if (dateFrom) where.submittedAt.gte = new Date(dateFrom)
      if (dateTo) where.submittedAt.lte = new Date(dateTo + 'T23:59:59.999Z')
    }

    if (make) {
      where.make = { contains: make, mode: 'insensitive' }
    }

    if (model) {
      where.model = { contains: model, mode: 'insensitive' }
    }

    if (search) {
      where.OR = [
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { vin: { contains: search, mode: 'insensitive' } },
        { registrationNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.vehicle.count({ where }),
    ])

    return NextResponse.json({
      vehicles,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('[STOCK] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch stock.' }, { status: 500 })
  }
}
