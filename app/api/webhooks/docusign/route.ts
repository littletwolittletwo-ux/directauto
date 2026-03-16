import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { downloadSignedDocument } from '@/lib/docusign-client'
import { saveToBlobStorage, saveFile, useBlobStorage } from '@/lib/storage'
import { Prisma } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    let payload: Record<string, unknown>

    // DocuSign sends XML by default, but we configure JSON via Connect
    // Try JSON first, fall back to basic parsing
    try {
      payload = JSON.parse(body)
    } catch {
      console.log('[DOCUSIGN_WEBHOOK] Non-JSON payload received, length:', body.length)
      return NextResponse.json({ status: 'ok' })
    }

    console.log('[DOCUSIGN_WEBHOOK] Event received:', JSON.stringify(payload).slice(0, 500))

    const envelopeId = (payload.envelopeId || payload.EnvelopeID) as string
    const status = (payload.status || payload.Status) as string

    if (!envelopeId) {
      console.log('[DOCUSIGN_WEBHOOK] No envelope ID in payload')
      return NextResponse.json({ status: 'ok' })
    }

    // Find the vehicle with this envelope ID
    const vehicle = await prisma.vehicle.findFirst({
      where: { docusignEnvelopeId: envelopeId },
    })

    if (!vehicle) {
      console.log('[DOCUSIGN_WEBHOOK] No vehicle found for envelope:', envelopeId)
      return NextResponse.json({ status: 'ok' })
    }

    if (status?.toLowerCase() === 'completed') {
      // Download the signed PDF
      try {
        const pdfBuffer = await downloadSignedDocument(envelopeId)

        // Save to document storage
        const fileName = `bill-of-sale-signed-${vehicle.vin}.pdf`
        let storagePath: string

        if (useBlobStorage()) {
          const result = await saveToBlobStorage(
            pdfBuffer,
            vehicle.id,
            'bill-of-sale-signed',
            fileName,
            'application/pdf'
          )
          storagePath = result.storagePath
        } else {
          const result = saveFile(
            pdfBuffer,
            vehicle.id,
            'bill-of-sale-signed',
            fileName,
            'application/pdf'
          )
          storagePath = result.storagePath
        }

        // Create document record
        await prisma.document.create({
          data: {
            vehicleId: vehicle.id,
            category: 'bill-of-sale-signed',
            originalName: fileName,
            storagePath,
            mimeType: 'application/pdf',
            sizeBytes: pdfBuffer.length,
          },
        })

        console.log('[DOCUSIGN_WEBHOOK] Signed PDF saved for vehicle:', vehicle.id)
      } catch (err) {
        console.error('[DOCUSIGN_WEBHOOK] Failed to download signed PDF:', err)
      }

      // Update vehicle status
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          docusignStatus: 'SIGNED',
          docusignSignedAt: new Date(),
        },
      })

      await logAudit({
        vehicleId: vehicle.id,
        action: 'DOCUSIGN_SIGNED',
        details: { envelopeId } as Prisma.InputJsonValue,
      })

      console.log('[DOCUSIGN_WEBHOOK] Vehicle updated to SIGNED:', vehicle.id)
    } else if (status?.toLowerCase() === 'declined' || status?.toLowerCase() === 'voided') {
      await prisma.vehicle.update({
        where: { id: vehicle.id },
        data: {
          docusignStatus: status.toUpperCase(),
        },
      })

      await logAudit({
        vehicleId: vehicle.id,
        action: `DOCUSIGN_${status.toUpperCase()}`,
        details: { envelopeId } as Prisma.InputJsonValue,
      })
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[DOCUSIGN_WEBHOOK] Error:', error)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
