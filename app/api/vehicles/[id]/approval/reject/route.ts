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

    const userRole = (session.user as Record<string, unknown>).role as string
    if (userRole !== 'ACCOUNTS' && userRole !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only ACCOUNTS or ADMIN users can reject purchases.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const userId = (session.user as Record<string, unknown>).id as string

    let body: { comment?: string } = {}
    try {
      body = await request.json()
    } catch {
      // comment is optional but encouraged
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 })
    }

    const currentStatus = (vehicle as Record<string, unknown>).approvalStatus as string | undefined ?? 'PENDING'

    // Update vehicle
    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        approvalComment: body.comment?.trim() || null,
      } as Record<string, unknown>,
    })

    // Write history
    await prisma.approvalHistory.create({
      data: {
        vehicleId: id,
        userId,
        action: 'rejected',
        comment: body.comment?.trim() || null,
      },
    })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'PURCHASE_REJECTED',
      details: {
        previousApprovalStatus: currentStatus,
        comment: body.comment?.trim() || null,
      } as Prisma.InputJsonValue,
    })

    return NextResponse.json({ vehicle: updated })
  } catch (error) {
    console.error('[APPROVAL_REJECT] Error:', error)
    return NextResponse.json(
      { error: 'Failed to reject vehicle.' },
      { status: 500 }
    )
  }
}
