import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { updateVehicleRisk } from '@/lib/risk-engine'
import { logAudit } from '@/lib/audit'
import { sendSellerConfirmation, sendAdminNewSubmission } from '@/lib/mailer'

// Allow large file uploads (photos + documents)
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i

async function generateConfirmationNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `VEH-${year}-`

  const count = await prisma.vehicle.count({
    where: {
      confirmationNumber: {
        startsWith: prefix,
      },
    },
  })

  const nextNumber = (count + 1).toString().padStart(4, '0')
  return `${prefix}${nextNumber}`
}

export async function POST(request: NextRequest) {
  try {
    // Get IP address for rate limiting and audit
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ip = forwardedFor?.split(',')[0]?.trim() || 'unknown'

    // Rate limit check
    const rateLimitResult = rateLimit(ip)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429 }
      )
    }

    // Parse JSON body (files already uploaded to Supabase Storage)
    const body = await request.json()

    // Honeypot check
    if (body.website) {
      return NextResponse.json(
        { error: 'Invalid submission.' },
        { status: 400 }
      )
    }

    // Extract text fields
    const vin = (body.vin || '').trim()
    const registrationNumber = (body.registrationNumber || '').trim()
    const make = (body.make || '').trim()
    const model = (body.model || '').trim()
    const year = (body.year || '').trim()
    const odometer = (body.odometer || '').trim()
    const sellerName = (body.sellerName || '').trim()
    const sellerPhone = (body.sellerPhone || '').trim()
    const sellerEmail = (body.sellerEmail || '').trim()
    const sellerAddress = (body.sellerAddress || '').trim()
    const licenceNumber = (body.licenceNumber || '').trim()
    const licenceState = (body.licenceState || '').trim()
    const licenceExpiry = (body.licenceExpiry || '').trim()
    const ownershipType = (body.ownershipType || '').trim()
    const ownershipNotes = (body.ownershipNotes || '').trim()
    const declarationAgreed = body.declarationAgreed === true || body.declarationAgreed === 'true'
    const consentAgreed = body.consentAgreed === true || body.consentAgreed === 'true'
    const signatureName = (body.signatureName || '').trim()
    const tokenId = body.tokenId || null

    // Supabase Storage paths (files already uploaded from browser)
    const licenceFrontPath = (body.licenceFrontPath || '').trim()
    const licenceBackPath = (body.licenceBackPath || '').trim()
    const selfiePath = (body.selfiePath || '').trim()
    const ownershipPaths: string[] = Array.isArray(body.ownershipPaths) ? body.ownershipPaths : []

    // Validate required fields
    const missingFields: string[] = []
    if (!vin) missingFields.push('vin')
    if (!make) missingFields.push('make')
    if (!model) missingFields.push('model')
    if (!year) missingFields.push('year')
    if (!odometer) missingFields.push('odometer')
    if (!sellerName) missingFields.push('sellerName')
    if (!sellerPhone) missingFields.push('sellerPhone')
    if (!sellerEmail) missingFields.push('sellerEmail')

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // VIN format validation
    if (!VIN_REGEX.test(vin)) {
      return NextResponse.json(
        { error: 'Invalid VIN format. Must be 17 alphanumeric characters.' },
        { status: 400 }
      )
    }

    // Validate declaration
    if (!declarationAgreed || !consentAgreed) {
      return NextResponse.json(
        { error: 'You must agree to the declaration and consent.' },
        { status: 400 }
      )
    }

    // Determine submission source
    const submissionSource = tokenId ? 'SINGLE_USE_LINK' : 'PUBLIC_PORTAL'

    // Check if a vehicle with this VIN already exists
    const existing = await prisma.vehicle.findUnique({
      where: { vin: vin.toUpperCase() },
      select: { id: true, confirmationNumber: true },
    })

    let vehicle: { id: string; confirmationNumber: string }

    if (existing && tokenId) {
      // Token submission for existing vehicle — UPDATE with seller details
      console.log('[SUBMIT] Token flow — updating existing vehicle:', existing.id)
      await prisma.vehicle.update({
        where: { id: existing.id },
        data: {
          sellerName,
          sellerPhone,
          sellerEmail,
          submissionSource,
          submissionToken: tokenId,
          ipAddress: ip,
          sellerSignature: signatureName,
          signedAt: new Date(),
          status: 'PENDING_VERIFICATION',
        },
      })
      vehicle = existing
    } else if (existing && !tokenId) {
      // Duplicate VIN without token — reject
      return NextResponse.json(
        { error: 'A vehicle with this VIN has already been submitted.' },
        { status: 409 }
      )
    } else {
      // No existing vehicle — create new
      const confirmationNumber = await generateConfirmationNumber()
      console.log('[SUBMIT] Creating new vehicle, VIN:', vin, 'confirmation:', confirmationNumber)
      const created = await prisma.vehicle.create({
        data: {
          confirmationNumber,
          vin: vin.toUpperCase(),
          registrationNumber,
          make,
          model,
          year: parseInt(year, 10),
          odometer: parseInt(odometer, 10),
          sellerName,
          sellerPhone,
          sellerEmail,
          submissionSource,
          submissionToken: tokenId || undefined,
          ipAddress: ip,
          sellerSignature: signatureName,
          signedAt: new Date(),
          status: 'PENDING_VERIFICATION',
        },
      })
      vehicle = { id: created.id, confirmationNumber: created.confirmationNumber }
    }

    console.log('[SUBMIT] Vehicle ready:', vehicle.id, vehicle.confirmationNumber)

    // Validate licence expiry date before creating identity
    let parsedLicenceExpiry: Date = new Date()
    if (licenceExpiry) {
      const d = new Date(licenceExpiry)
      if (isNaN(d.getTime()) || d.getFullYear() > 2100) {
        return NextResponse.json(
          { error: 'Invalid licence expiry date.' },
          { status: 400 }
        )
      }
      parsedLicenceExpiry = d
    }

    // Create SellerIdentity record
    try {
      await prisma.sellerIdentity.create({
        data: {
          vehicleId: vehicle.id,
          fullLegalName: sellerName,
          address: sellerAddress || 'Not provided',
          driversLicenceNumber: licenceNumber || 'Not provided',
          licenceState: licenceState || 'NSW',
          licenceExpiry: parsedLicenceExpiry,
        },
      })
      console.log('[SUBMIT] SellerIdentity created')
    } catch (idErr) {
      console.error('[SUBMIT] SellerIdentity create failed (non-fatal):', idErr instanceof Error ? idErr.message : idErr)
    }

    // Create OwnershipRecord
    if (ownershipType) {
      try {
        await prisma.ownershipRecord.create({
          data: {
            vehicleId: vehicle.id,
            documentType: ownershipType,
            notes: ownershipNotes || null,
          },
        })
        console.log('[SUBMIT] OwnershipRecord created')
      } catch (ownErr) {
        console.error('[SUBMIT] OwnershipRecord create failed (non-fatal):', ownErr instanceof Error ? ownErr.message : ownErr)
      }
    }

    // Create Document records from Supabase Storage paths (files already uploaded from browser)
    const createDocFromPath = async (
      storagePath: string,
      category: string,
      vehId: string
    ): Promise<string> => {
      const fileName = storagePath.split('/').pop() || 'file'
      const ext = fileName.split('.').pop()?.toLowerCase() || ''
      const mimeType = ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`

      console.log('[SUBMIT] Creating doc record:', category, storagePath)

      const doc = await prisma.document.create({
        data: {
          vehicleId: vehId,
          category,
          originalName: fileName,
          storagePath,
          mimeType,
          sizeBytes: 0,
        },
      })
      return doc.id
    }

    let licenceFrontDocId: string | null = null
    let licenceBackDocId: string | null = null
    let selfieDocId: string | null = null

    try {
      if (licenceFrontPath) {
        licenceFrontDocId = await createDocFromPath(licenceFrontPath, 'licence-front', vehicle.id)
      }
      if (licenceBackPath) {
        licenceBackDocId = await createDocFromPath(licenceBackPath, 'licence-back', vehicle.id)
      }
      if (selfiePath) {
        selfieDocId = await createDocFromPath(selfiePath, 'selfie', vehicle.id)
      }

      // Create records for ownership files
      for (const path of ownershipPaths) {
        if (path) {
          await createDocFromPath(path, 'ownership', vehicle.id)
        }
      }
      console.log('[SUBMIT] Document records created')
    } catch (docErr) {
      console.error('[SUBMIT] Document record creation failed (non-fatal):', docErr instanceof Error ? docErr.message : docErr)
    }

    // Update SellerIdentity with document IDs
    if (licenceFrontDocId || licenceBackDocId || selfieDocId) {
      try {
        await prisma.sellerIdentity.update({
          where: { vehicleId: vehicle.id },
          data: {
            ...(licenceFrontDocId && { licenceFrontDocId }),
            ...(licenceBackDocId && { licenceBackDocId }),
            ...(selfieDocId && { selfieDocId }),
          },
        })
      } catch (docIdErr) {
        console.error('[SUBMIT] SellerIdentity doc ID update failed (non-fatal):', docIdErr instanceof Error ? docIdErr.message : docIdErr)
      }
    }

    // Mark token as used if applicable
    if (tokenId) {
      try {
        await prisma.submissionToken.update({
          where: { id: tokenId },
          data: { used: true },
        })
      } catch (tokenErr) {
        console.error('[SUBMIT] Token update failed (non-fatal):', tokenErr instanceof Error ? tokenErr.message : tokenErr)
      }
    }

    // Run risk engine (non-fatal — vehicle is already saved)
    try {
      await updateVehicleRisk(vehicle.id)
      console.log('[SUBMIT] Risk engine complete')
    } catch (riskErr) {
      console.error('[SUBMIT] Risk engine failed (non-fatal):', riskErr instanceof Error ? riskErr.message : riskErr)
    }

    // Log audit (non-fatal)
    try {
      await logAudit({
        vehicleId: vehicle.id,
        action: 'VEHICLE_SUBMITTED',
        details: {
          source: submissionSource,
          confirmationNumber: vehicle.confirmationNumber,
        } as Prisma.InputJsonValue,
        ipAddress: ip,
      })
    } catch (auditErr) {
      console.error('[SUBMIT] Audit log failed (non-fatal):', auditErr instanceof Error ? auditErr.message : auditErr)
    }

    // Send emails (non-fatal)
    try {
      const settings = await prisma.settings.findUnique({
        where: { id: 'singleton' },
      })
      const dealershipName = settings?.dealershipName || 'Direct Auto Wholesale'

      await sendSellerConfirmation({
        to: sellerEmail,
        sellerName,
        confirmationNumber: vehicle.confirmationNumber,
        vin: vin.toUpperCase(),
        make,
        model,
        year: parseInt(year, 10),
        dealershipName,
        contactEmail: settings?.contactEmail || undefined,
      }).catch((err) => {
        console.error('[SUBMIT] Seller confirmation email failed:', err instanceof Error ? err.message : err)
      })

      if (settings?.notifyOnSubmit && settings?.contactEmail) {
        await sendAdminNewSubmission({
          to: settings.contactEmail,
          confirmationNumber: vehicle.confirmationNumber,
          sellerName,
          make,
          model,
          vehicleId: vehicle.id,
          dealershipName,
        }).catch((err) => {
          console.error('[SUBMIT] Admin notification email failed:', err instanceof Error ? err.message : err)
        })
      }
    } catch (emailErr) {
      console.error('[SUBMIT] Email sending failed (non-fatal):', emailErr instanceof Error ? emailErr.message : emailErr)
    }

    console.log('[SUBMIT] Success! Confirmation:', vehicle.confirmationNumber)
    return NextResponse.json({
      confirmationNumber: vehicle.confirmationNumber,
      vehicleId: vehicle.id,
    })
  } catch (error) {
    console.error('[SUBMIT] FATAL submission error:', error instanceof Error ? error.message : error)
    console.error('[SUBMIT] Full error:', error)

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'A vehicle with this VIN has already been submitted.' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'An internal error occurred. Please try again later.' },
      { status: 500 }
    )
  }
}
