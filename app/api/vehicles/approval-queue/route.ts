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

    const userRole = (session.user as Record<string, unknown>).role as string
    if (userRole !== 'ACCOUNTS' && userRole !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only ACCOUNTS or ADMIN users can view the approval queue.' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status') || 'PENDING'
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '20', 10)
    const skip = (page - 1) * limit

    const where = {
      approvalStatus: status as 'PENDING' | 'APPROVED' | 'REJECTED',
    }

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
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
    console.error('[APPROVAL_QUEUE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch approval queue.' },
      { status: 500 }
    )
  }
}
