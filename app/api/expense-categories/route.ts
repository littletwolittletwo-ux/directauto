import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — list all expense categories
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const categories = await prisma.expenseCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('[EXPENSE_CATEGORIES] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch categories.' }, { status: 500 })
  }
}

// POST — create a new category (admin/accounts only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as Record<string, unknown>).role as string
    if (role !== 'ADMIN' && role !== 'ACCOUNTS') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { name, sortOrder } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required.' }, { status: 400 })
    }

    const category = await prisma.expenseCategory.create({
      data: {
        name,
        sortOrder: sortOrder ?? 0,
      },
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    console.error('[EXPENSE_CATEGORY_CREATE] Error:', error)
    return NextResponse.json({ error: 'Failed to create category.' }, { status: 500 })
  }
}
