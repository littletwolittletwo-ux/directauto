import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { syncVehicle, generateCSV, isApiEnabled } from '@/lib/easycars-client'
import { sendApprovalConfirmation } from '@/lib/mailer'

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
      return NextResponse.json({ error: 'Only ACCOUNTS or ADMIN users can approve payments' }, { status: 403 })
    }

    const { id } = await params
    const userId = (session.user as Record<string, unknown>).id as string

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: { ppsrCheck: true, documents: true, identity: true },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Validate checklist
    const errors: string[] = []
    if (!vehicle.ppsrCheck || vehicle.ppsrCheck.status !== 'COMPLETED') {
      errors.push('PPSR check not completed')
    }
    const hasInspection = vehicle.documents.some((d) => d.category === 'INSPECTION_REPORT') || vehicle.inspectedAt
    if (!hasInspection) {
      errors.push('Inspection report not uploaded')
    }
    if (vehicle.docusignStatus !== 'SIGNED') {
      errors.push('Bill of Sale not signed')
    }
    if (!vehicle.purchasePrice) {
      errors.push('Purchase price not set')
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Approval checklist incomplete', details: errors }, { status: 400 })
    }

    // Sync to EasyCars
    let easycarsMethod: 'api' | 'csv' = 'csv'
    let csvContent: string | null = null

    try {
      const vehicleData = {
        vin: vehicle.vin,
        registrationNumber: vehicle.registrationNumber,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        odometer: vehicle.odometer,
        purchasePrice: vehicle.purchasePrice!,
        sellerName: vehicle.sellerName,
        sellerPhone: vehicle.sellerPhone,
        sellerEmail: vehicle.sellerEmail,
      }

      if (isApiEnabled()) {
        const result = await syncVehicle(vehicleData)
        easycarsMethod = result.method
      }

      csvContent = generateCSV(vehicleData)
    } catch (err) {
      console.error('[APPROVE_PAY] EasyCars sync failed:', err)
      // Non-fatal: still approve the vehicle
    }

    // Update vehicle
    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        status: 'APPROVED',
        accountsApprovedAt: new Date(),
        accountsApprovedById: userId,
        easycarsSyncedAt: isApiEnabled() ? new Date() : null,
      },
    })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'ACCOUNTS_APPROVED',
      details: {
        purchasePrice: vehicle.purchasePrice,
        easycarsMethod,
      } as Prisma.InputJsonValue,
    })

    // Send confirmation email
    try {
      const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
      if (settings?.contactEmail) {
        await sendApprovalConfirmation({
          to: settings.contactEmail,
          vehicleMake: vehicle.make,
          vehicleModel: vehicle.model,
          vehicleYear: vehicle.year,
          vin: vehicle.vin,
          purchasePrice: vehicle.purchasePrice!,
          approvedBy: (session.user as Record<string, unknown>).name as string,
          dealershipName: settings.dealershipName,
          csvContent: !isApiEnabled() ? csvContent : undefined,
        })
      }
    } catch (err) {
      console.error('[APPROVE_PAY] Failed to send confirmation email:', err)
    }

    return NextResponse.json({
      vehicle: updated,
      easycars: {
        method: easycarsMethod,
        csv: csvContent,
      },
    })
  } catch (error) {
    console.error('[APPROVE_PAY] Error:', error)
    return NextResponse.json({ error: 'Failed to approve and pay' }, { status: 500 })
  }
}
