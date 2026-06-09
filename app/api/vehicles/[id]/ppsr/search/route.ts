import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { searchMV, downloadSearchCertificate } from '@/lib/ppsr-cloud-client'
import { Prisma } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/vehicles/[id]/ppsr/search
 *
 * Perform a PPSR Cloud motor vehicle search by VIN.
 * Returns security interests, NEVDIS flags, and generates search certificate.
 * This is the compulsory PPSR search (every deal, every path).
 */
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

    if (!vehicle.vin) {
      return NextResponse.json({ error: 'Vehicle VIN is required for PPSR search.' }, { status: 400 })
    }

    // Perform MV search
    const searchResult = await searchMV(vehicle.vin, {
      customerRequestId: `vehicle-${id}-${Date.now()}`,
      reference: `Direct Auto - ${vehicle.make} ${vehicle.model} ${vehicle.year}`,
    })

    // Download search certificate if available
    let certificatePdf: string | null = null
    if (searchResult.searchCertificateNumber) {
      try {
        const cert = await downloadSearchCertificate(searchResult.searchCertificateNumber)
        certificatePdf = cert.pdfBase64
      } catch (certErr) {
        console.warn('[PPSR-Search] Certificate download failed:', certErr)
      }
    }

    // Update vehicle PPSR check record
    await prisma.vehicle.update({
      where: { id },
      data: {
        ppsrCheck: {
          upsert: {
            create: {
              checkedAt: new Date(),
              checkedById: userId,
              isWrittenOff: searchResult.nevdisWrittenOff,
              isStolen: searchResult.nevdisStolen,
              hasFinance: searchResult.securityInterestExists,
              status: searchResult.securityInterestExists || searchResult.nevdisWrittenOff || searchResult.nevdisStolen
                ? 'ALERT'
                : 'CLEAR',
              rawResult: searchResult.rawResponse as Prisma.InputJsonValue,
            },
            update: {
              checkedAt: new Date(),
              checkedById: userId,
              isWrittenOff: searchResult.nevdisWrittenOff,
              isStolen: searchResult.nevdisStolen,
              hasFinance: searchResult.securityInterestExists,
              status: searchResult.securityInterestExists || searchResult.nevdisWrittenOff || searchResult.nevdisStolen
                ? 'ALERT'
                : 'CLEAR',
              rawResult: searchResult.rawResponse as Prisma.InputJsonValue,
            },
          },
        },
      },
    })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'PPSR_SEARCHED',
      details: {
        searchNumber: searchResult.searchNumber,
        certificateNumber: searchResult.searchCertificateNumber,
        securityInterestExists: searchResult.securityInterestExists,
        nevdisWrittenOff: searchResult.nevdisWrittenOff,
        nevdisStolen: searchResult.nevdisStolen,
        resultCount: searchResult.resultCount,
      } as Prisma.InputJsonValue,
    })

    return NextResponse.json({
      searchNumber: searchResult.searchNumber,
      searchCertificateNumber: searchResult.searchCertificateNumber,
      securityInterestExists: searchResult.securityInterestExists,
      resultCount: searchResult.resultCount,
      nevdisWrittenOff: searchResult.nevdisWrittenOff,
      nevdisStolen: searchResult.nevdisStolen,
      registrations: searchResult.registrations,
      hasCertificate: !!certificatePdf,
      certificatePdfBase64: certificatePdf,
    })
  } catch (error) {
    console.error('[PPSR_SEARCH] Error:', error)
    const message = error instanceof Error ? error.message : 'PPSR search failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
