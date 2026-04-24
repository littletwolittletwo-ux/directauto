import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { Prisma } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string; expenseId: string }>
}

// PATCH — update an expense
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, expenseId } = await params
    const userId = (session.user as Record<string, unknown>).id as string

    const expense = await prisma.applicationExpense.findFirst({
      where: { id: expenseId, vehicleId: id },
    })

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found.' }, { status: 404 })
    }

    // Block editing of auto-sourced expenses
    if (expense.source !== 'manual') {
      return NextResponse.json(
        { error: 'Auto-generated expenses cannot be edited.' },
        { status: 422 }
      )
    }

    const body = await request.json()
    const { categoryId, amountCents, expenseDate, supplier, notes, receiptFileUrl } = body

    const before = { ...expense }

    const updated = await prisma.applicationExpense.update({
      where: { id: expenseId },
      data: {
        ...(categoryId && { categoryId }),
        ...(amountCents !== undefined && { amountCents: Math.round(Number(amountCents)) }),
        ...(expenseDate && { expenseDate: new Date(expenseDate) }),
        ...(supplier !== undefined && { supplier: supplier || null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(receiptFileUrl !== undefined && { receiptFileUrl: receiptFileUrl || null }),
      },
      include: { category: { select: { id: true, name: true } } },
    })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'EXPENSE_UPDATED',
      details: {
        expenseId,
        before: { amountCents: before.amountCents, categoryId: before.categoryId },
        after: { amountCents: updated.amountCents, categoryId: updated.categoryId },
      } as Prisma.InputJsonValue,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[EXPENSE_UPDATE] Error:', error)
    return NextResponse.json({ error: 'Failed to update expense.' }, { status: 500 })
  }
}

// DELETE — delete an expense
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, expenseId } = await params
    const userId = (session.user as Record<string, unknown>).id as string

    const expense = await prisma.applicationExpense.findFirst({
      where: { id: expenseId, vehicleId: id },
    })

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found.' }, { status: 404 })
    }

    if (expense.source !== 'manual') {
      return NextResponse.json(
        { error: 'Auto-generated expenses cannot be deleted.' },
        { status: 422 }
      )
    }

    await prisma.applicationExpense.delete({ where: { id: expenseId } })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'EXPENSE_DELETED',
      details: {
        expenseId,
        amountCents: expense.amountCents,
        categoryId: expense.categoryId,
      } as Prisma.InputJsonValue,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[EXPENSE_DELETE] Error:', error)
    return NextResponse.json({ error: 'Failed to delete expense.' }, { status: 500 })
  }
}
