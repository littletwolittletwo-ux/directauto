import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { Prisma } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/vehicles/[id]/dd-checklist
 * Returns the DD checklist for a vehicle, creating one if it doesn't exist.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    let checklist = await prisma.dDChecklist.findUnique({ where: { vehicleId: id } })

    if (!checklist) {
      checklist = await prisma.dDChecklist.create({
        data: { vehicleId: id },
      })
    }

    return NextResponse.json(checklist)
  } catch (error) {
    console.error('[DD_CHECKLIST_GET] Error:', error)
    return NextResponse.json({ error: 'Failed to get DD checklist' }, { status: 500 })
  }
}

/**
 * PATCH /api/vehicles/[id]/dd-checklist
 * Update individual checklist items.
 * Body: { field: value, ... }
 *
 * Stage 1 fields: inspectionReviewed, licenceVerified, regoOwnerConfirmed,
 *   ppsrConfirmed, bankVerified, financePayoutVerified, financePayoutNa
 * Stage 2 fields: stage2Approved (true/false), stage2RejectionReason
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const userId = (session.user as Record<string, unknown>).id as string
    const body = await request.json()

    // Ensure checklist exists
    let checklist = await prisma.dDChecklist.findUnique({ where: { vehicleId: id } })
    if (!checklist) {
      checklist = await prisma.dDChecklist.create({ data: { vehicleId: id } })
    }

    const now = new Date()
    const updateData: Record<string, unknown> = {}

    // Stage 1 check fields
    const stage1Fields = [
      'inspectionReviewed', 'licenceVerified', 'regoOwnerConfirmed',
      'ppsrConfirmed', 'bankVerified', 'financePayoutVerified', 'financePayoutNa'
    ]

    for (const field of stage1Fields) {
      if (field in body) {
        updateData[field] = body[field]
        if (body[field] === true) {
          updateData[`${field}At`] = now
        }
      }
    }

    // Check if all Stage 1 items are complete
    const stage1Complete = (
      (body.inspectionReviewed ?? checklist.inspectionReviewed) &&
      (body.licenceVerified ?? checklist.licenceVerified) &&
      (body.regoOwnerConfirmed ?? checklist.regoOwnerConfirmed) &&
      (body.ppsrConfirmed ?? checklist.ppsrConfirmed) &&
      (body.bankVerified ?? checklist.bankVerified) &&
      ((body.financePayoutVerified ?? checklist.financePayoutVerified) ||
       (body.financePayoutNa ?? checklist.financePayoutNa))
    )

    if (stage1Complete && !checklist.stage1CompletedAt) {
      updateData.stage1CompletedAt = now
      updateData.stage1CompletedById = userId
    }

    // Stage 2 approval/rejection
    if ('stage2Approved' in body) {
      // Block same-user double-approval
      if (checklist.stage1CompletedById === userId) {
        return NextResponse.json(
          { error: 'Same user cannot complete both Stage 1 and Stage 2 approval.' },
          { status: 403 }
        )
      }

      if (body.stage2Approved === true) {
        updateData.stage2ApprovedAt = now
        updateData.stage2ApprovedById = userId
        updateData.stage2RejectedAt = null
        updateData.stage2RejectionReason = null
      } else {
        updateData.stage2RejectedAt = now
        updateData.stage2RejectionReason = body.stage2RejectionReason || 'Rejected by 2nd approver'
        updateData.stage2ApprovedAt = null
        updateData.stage2ApprovedById = null
      }
    }

    const updated = await prisma.dDChecklist.update({
      where: { vehicleId: id },
      data: updateData as Prisma.DDChecklistUpdateInput,
    })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'DD_CHECKLIST_UPDATED',
      details: { fields: Object.keys(updateData) } as Prisma.InputJsonValue,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[DD_CHECKLIST_PATCH] Error:', error)
    return NextResponse.json({ error: 'Failed to update DD checklist' }, { status: 500 })
  }
}
