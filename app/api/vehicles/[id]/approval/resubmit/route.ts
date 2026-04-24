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

    const { id } = await params
    const userId = (session.user as Record<string, unknown>).id as string

    let body: { comment?: string } = {}
    try {
      body = await request.json()
    } catch {
      // comment optional
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 })
    }

    const currentStatus = (vehicle as Record<string, unknown>).approvalStatus as string | undefined ?? 'PENDING'

    if (currentStatus !== 'REJECTED') {
      return NextResponse.json(
        { error: 'Only rejected applications can be resubmitted.' },
        { status: 400 }
      )
    }

    // Move back to PENDING
    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        approvalStatus: 'PENDING',
        approvalComment: null,
      } as Record<string, unknown>,
    })

    await prisma.approvalHistory.create({
      data: {
        vehicleId: id,
        userId,
        action: 'resubmitted',
        comment: body.comment?.trim() || null,
      },
    })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'PURCHASE_RESUBMITTED',
      details: {
        previousApprovalStatus: currentStatus,
        comment: body.comment?.trim() || null,
      } as Prisma.InputJsonValue,
    })

    return NextResponse.json({ vehicle: updated })
  } catch (error) {
    console.error('[APPROVAL_RESUBMIT] Error:', error)
    return NextResponse.json(
      { error: 'Failed to resubmit vehicle.' },
      { status: 500 }
    )
  }
}
