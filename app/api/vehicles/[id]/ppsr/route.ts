import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { updateVehicleRisk } from '@/lib/risk-engine'
import { logAudit } from '@/lib/audit'
import { sendPPSRFlagAlert } from '@/lib/mailer'
import { searchByVIN } from '@/lib/ppsr-client'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST: Run live PPSR check or save manual results
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userId = (session.user as Record<string, unknown>).id as string

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found.' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const isLiveSearch = body.live === true

    let isWrittenOff: boolean
    let isStolen: boolean
    let hasFinance: boolean
    let rawResult: Prisma.InputJsonValue | typeof Prisma.DbNull = Prisma.DbNull
    let status: string

    if (isLiveSearch) {
      // Live PPSR Cloud API search
      const result = await searchByVIN(vehicle.vin)
      isWrittenOff = result.isWrittenOff
      isStolen = result.isStolen
      hasFinance = result.hasFinance
      rawResult = result.rawResult as Prisma.InputJsonValue
      status = 'COMPLETED'
    } else {
      // Manual entry (legacy flow)
      isWrittenOff = !!body.isWrittenOff
      isStolen = !!body.isStolen
      hasFinance = !!body.hasFinance
      rawResult = body.rawResult || Prisma.DbNull
      status = body.status || 'COMPLETED'
    }

    // Upsert PPSRCheck record
    const ppsrCheck = await prisma.pPSRCheck.upsert({
      where: { vehicleId: id },
      create: {
        vehicleId: id,
        checkedAt: new Date(),
        checkedById: userId,
        isWrittenOff,
        isStolen,
        hasFinance,
        certificateDocId: body.certificateDocId || null,
        rawResult,
        status,
      },
      update: {
        checkedAt: new Date(),
        checkedById: userId,
        isWrittenOff,
        isStolen,
        hasFinance,
        certificateDocId: body.certificateDocId || null,
        rawResult,
        status,
      },
    })

    // Recalculate risk
    const risk = await updateVehicleRisk(id)

    // Send PPSR flag alert if flags detected
    const hasFlags = isWrittenOff || isStolen || hasFinance
    if (hasFlags) {
      const settings = await prisma.settings.findUnique({
        where: { id: 'singleton' },
      })

      if (settings?.notifyOnPPSR && settings?.contactEmail) {
        const flags: string[] = []
        if (isWrittenOff) flags.push('Vehicle recorded as written off')
        if (isStolen) flags.push('Vehicle recorded as stolen')
        if (hasFinance) flags.push('Finance recorded on PPSR')

        await sendPPSRFlagAlert({
          to: settings.contactEmail,
          vin: vehicle.vin,
          flags,
          vehicleId: id,
          dealershipName: settings.dealershipName,
        }).catch((err) => {
          console.error('[PPSR] Failed to send PPSR flag alert:', err)
        })
      }
    }

    // Log audit
    await logAudit({
      vehicleId: id,
      userId,
      action: isLiveSearch ? 'PPSR_LIVE_CHECK' : 'PPSR_UPDATED',
      details: {
        isWrittenOff,
        isStolen,
        hasFinance,
        status,
        riskScore: risk.riskScore,
        riskFlags: risk.riskFlags,
        source: isLiveSearch ? 'ppsr_cloud_api' : 'manual',
      } as Prisma.InputJsonValue,
    })

    return NextResponse.json({
      ppsrCheck,
      risk,
    })
  } catch (error) {
    console.error('[PPSR_CHECK] Error:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to run PPSR check.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
