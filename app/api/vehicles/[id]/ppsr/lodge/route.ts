import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { requireApproved, ApprovalRequiredError } from '@/lib/approval'
import { lodge, PPSRError } from '@/lib/ppsr-lodge-service'
import { Prisma } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userId = (session.user as Record<string, unknown>).id as string

    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 })
    }

    // Gate on approval
    requireApproved(vehicle as Record<string, unknown>)

    // Check for existing active record (idempotency)
    const existingActive = await prisma.pPSRRecord.findFirst({
      where: { vehicleId: id, status: 'active' },
    })

    if (existingActive) {
      return NextResponse.json(
        { error: 'An active PPSR registration already exists for this vehicle.', record: existingActive },
        { status: 409 }
      )
    }

    // Create a pending record
    const record = await prisma.pPSRRecord.create({
      data: {
        vehicleId: id,
        status: 'pending',
        provider: 'mock', // Replace with actual provider
        requestPayload: {
          vin: vehicle.vin,
          registrationNumber: vehicle.registrationNumber,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          sellerName: vehicle.sellerName,
        } as Prisma.InputJsonValue,
        createdByUserId: userId,
      },
    })

    try {
      // Call the PPSR provider
      const result = await lodge({
        vin: vehicle.vin,
        registrationNumber: vehicle.registrationNumber,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        sellerName: vehicle.sellerName,
      })

      // Transaction: update record + create expense
      await prisma.$transaction(async (tx) => {
        await tx.pPSRRecord.update({
          where: { id: record.id },
          data: {
            status: 'active',
            registrationNumber: result.registrationNumber,
            lodgedAt: new Date(),
            expiresAt: result.expiresAt,
            feeCents: result.feeCents,
            providerReference: result.providerReference,
            responsePayload: result as unknown as Prisma.InputJsonValue,
          },
        })

        // Find the "PPSR Fees" category
        const ppsrCategory = await tx.expenseCategory.findFirst({
          where: { name: 'PPSR Fees' },
        })

        if (ppsrCategory) {
          await tx.applicationExpense.create({
            data: {
              vehicleId: id,
              categoryId: ppsrCategory.id,
              amountCents: result.feeCents,
              expenseDate: new Date(),
              supplier: 'PPSR',
              notes: `PPSR lodgement - Reg: ${result.registrationNumber}`,
              source: 'ppsr_auto',
              createdByUserId: userId,
            },
          })
        }
      })

      await logAudit({
        vehicleId: id,
        userId,
        action: 'PPSR_LODGED',
        details: {
          registrationNumber: result.registrationNumber,
          feeCents: result.feeCents,
          expiresAt: result.expiresAt,
        } as Prisma.InputJsonValue,
      })

      const updatedRecord = await prisma.pPSRRecord.findUnique({ where: { id: record.id } })
      return NextResponse.json(updatedRecord)
    } catch (lodgeError) {
      // Update record to failed
      const errorMessage = lodgeError instanceof Error ? lodgeError.message : 'Unknown error'
      await prisma.pPSRRecord.update({
        where: { id: record.id },
        data: {
          status: 'failed',
          errorMessage,
          responsePayload: { error: errorMessage } as Prisma.InputJsonValue,
        },
      })

      await logAudit({
        vehicleId: id,
        userId,
        action: 'PPSR_LODGE_FAILED',
        details: { error: errorMessage } as Prisma.InputJsonValue,
      })

      const statusCode = lodgeError instanceof PPSRError && !lodgeError.retryable ? 422 : 500
      return NextResponse.json({ error: errorMessage, recordId: record.id }, { status: statusCode })
    }
  } catch (error) {
    if (error instanceof ApprovalRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[PPSR_LODGE] Error:', error)
    return NextResponse.json({ error: 'Failed to lodge PPSR.' }, { status: 500 })
  }
}
