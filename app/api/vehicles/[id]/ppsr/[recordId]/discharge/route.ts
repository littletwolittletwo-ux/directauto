import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { discharge, PPSRError } from '@/lib/ppsr-lodge-service'
import { Prisma } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string; recordId: string }>
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, recordId } = await params
    const userId = (session.user as Record<string, unknown>).id as string

    const record = await prisma.pPSRRecord.findFirst({
      where: { id: recordId, vehicleId: id },
    })

    if (!record) {
      return NextResponse.json({ error: 'PPSR record not found.' }, { status: 404 })
    }

    if (record.status !== 'active') {
      return NextResponse.json(
        { error: `Cannot discharge a record with status "${record.status}". Only active records can be discharged.` },
        { status: 422 }
      )
    }

    // Call the PPSR provider to discharge
    const result = await discharge(record.registrationNumber || '')

    // Update record to discharged
    const updated = await prisma.pPSRRecord.update({
      where: { id: recordId },
      data: {
        status: 'discharged',
        dischargedAt: result.dischargedAt,
        dischargedByUserId: userId,
      },
    })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'PPSR_DISCHARGED',
      details: {
        registrationNumber: record.registrationNumber,
        providerReference: result.providerReference,
      } as Prisma.InputJsonValue,
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof PPSRError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('[PPSR_DISCHARGE] Error:', error)
    return NextResponse.json({ error: 'Failed to discharge PPSR.' }, { status: 500 })
  }
}
