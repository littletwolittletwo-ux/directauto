import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { Prisma } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET — list expenses for a vehicle
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const expenses = await prisma.applicationExpense.findMany({
      where: { vehicleId: id },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { expenseDate: 'desc' },
    })

    return NextResponse.json(expenses)
  } catch (error) {
    console.error('[EXPENSES_LIST] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch expenses.' }, { status: 500 })
  }
}

// POST — add a new expense
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userId = (session.user as Record<string, unknown>).id as string
    const body = await request.json()

    const { categoryId, amountCents, expenseDate, supplier, notes, receiptFileUrl } = body

    if (!categoryId || amountCents === undefined || !expenseDate) {
      return NextResponse.json(
        { error: 'categoryId, amountCents, and expenseDate are required.' },
        { status: 400 }
      )
    }

    const expense = await prisma.applicationExpense.create({
      data: {
        vehicleId: id,
        categoryId,
        amountCents: Math.round(Number(amountCents)),
        expenseDate: new Date(expenseDate),
        supplier: supplier || null,
        notes: notes || null,
        receiptFileUrl: receiptFileUrl || null,
        source: 'manual',
        createdByUserId: userId,
      },
      include: { category: { select: { id: true, name: true } } },
    })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'EXPENSE_ADDED',
      details: {
        expenseId: expense.id,
        categoryName: expense.category.name,
        amountCents: expense.amountCents,
      } as Prisma.InputJsonValue,
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('[EXPENSE_ADD] Error:', error)
    return NextResponse.json({ error: 'Failed to add expense.' }, { status: 500 })
  }
}
