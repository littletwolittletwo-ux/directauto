import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/buyer-dealers
 * List all buyer-dealers with optional filtering.
 * Query: ?creditStatus=ACTIVE&search=name
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const creditStatus = searchParams.get('creditStatus')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}
    if (creditStatus) where.creditStatus = creditStatus
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const dealers = await prisma.buyerDealer.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { vehicles: true } },
      },
    })

    return NextResponse.json(dealers)
  } catch (error) {
    console.error('[BUYER_DEALERS_GET] Error:', error)
    return NextResponse.json({ error: 'Failed to list buyer-dealers' }, { status: 500 })
  }
}

/**
 * POST /api/buyer-dealers
 * Create a new buyer-dealer.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name, contactName, email, phone, address, abn, lmctNumber, notes } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const dealer = await prisma.buyerDealer.create({
      data: { name, contactName, email, phone, address, abn, lmctNumber, notes },
    })

    return NextResponse.json(dealer, { status: 201 })
  } catch (error) {
    console.error('[BUYER_DEALERS_POST] Error:', error)
    return NextResponse.json({ error: 'Failed to create buyer-dealer' }, { status: 500 })
  }
}
