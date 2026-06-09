import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { transitionDealStatus, getAllowedTransitions, DealStatus } from '@/lib/deal-workflow'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/vehicles/[id]/deal-status
 * Body: { status: DealStatus, reason?: string, force?: boolean }
 *
 * Transition a deal to a new status with workflow validation.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userId = (session.user as Record<string, unknown>).id as string
    const body = await request.json()
    const { status, reason, force } = body as { status: DealStatus; reason?: string; force?: boolean }

    if (!status) {
      return NextResponse.json({ error: 'status is required' }, { status: 400 })
    }

    await transitionDealStatus(id, status, userId, { reason, force })

    return NextResponse.json({ success: true, newStatus: status })
  } catch (error) {
    if (error instanceof Error && error.name === 'WorkflowError') {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('[DEAL_STATUS] Error:', error)
    return NextResponse.json({ error: 'Failed to update deal status' }, { status: 500 })
  }
}

/**
 * GET /api/vehicles/[id]/deal-status
 *
 * Get current deal status and allowed transitions.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { prisma } = await import('@/lib/prisma')

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      select: {
        dealStatus: true,
        sellerType: true,
        ppsrPath: true,
        contractSignedAt: true,
        paidAt: true,
        soldAt: true,
        closedAt: true,
        cancelledAt: true,
        cancelReason: true,
        inspectionPassed: true,
      },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    const currentStatus = (vehicle.dealStatus as DealStatus) || 'SOURCED'
    const allowedTransitions = getAllowedTransitions(currentStatus)

    return NextResponse.json({
      currentStatus,
      allowedTransitions,
      sellerType: vehicle.sellerType,
      ppsrPath: vehicle.ppsrPath,
      timestamps: {
        contractSignedAt: vehicle.contractSignedAt,
        paidAt: vehicle.paidAt,
        soldAt: vehicle.soldAt,
        closedAt: vehicle.closedAt,
        cancelledAt: vehicle.cancelledAt,
      },
      cancelReason: vehicle.cancelReason,
      inspectionPassed: vehicle.inspectionPassed,
    })
  } catch (error) {
    console.error('[DEAL_STATUS_GET] Error:', error)
    return NextResponse.json({ error: 'Failed to get deal status' }, { status: 500 })
  }
}
