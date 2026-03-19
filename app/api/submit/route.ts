import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { saveFile, saveToBlobStorage, useBlobStorage } from '@/lib/storage'
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

    // Parse FormData
    const formData = await request.formData()

    // Honeypot check
    const honeypot = formData.get('website') as string | null
    if (honeypot) {
      return NextResponse.json(
        { error: 'Invalid submission.' },
        { status: 400 }
      )
    }

    // Extract text fields
    const vin = (formData.get('vin') as string || '').trim()
    const registrationNumber = (formData.get('registrationNumber') as string || '').trim()
    const make = (formData.get('make') as string || '').trim()
    const model = (formData.get('model') as string || '').trim()
    const year = (formData.get('year') as string || '').trim()
    const odometer = (formData.get('odometer') as string || '').trim()
    const sellerName = (formData.get('sellerName') as string || '').trim()
    const sellerPhone = (formData.get('sellerPhone') as string || '').trim()
    const sellerEmail = (formData.get('sellerEmail') as string || '').trim()
    const sellerAddress = (formData.get('sellerAddress') as string || '').trim()
    const licenceNumber = (formData.get('licenceNumber') as string || '').trim()
    const licenceState = (formData.get('licenceState') as string || '').trim()
    const licenceExpiry = (formData.get('licenceExpiry') as string || '').trim()
    const ownershipType = (formData.get('ownershipType') as string || '').trim()
    const ownershipNotes = (formData.get('ownershipNotes') as string || '').trim()
    const declarationAgreed = formData.get('declarationAgreed') === 'true'
    const consentAgreed = formData.get('consentAgreed') === 'true'
    const signatureName = (formData.get('signatureName') as string || '').trim()
    const tokenId = (formData.get('tokenId') as string | null) || null

    // File fields
    const licenceFront = formData.get('licenceFront') as File | null
    const licenceBack = formData.get('licenceBack') as File | null
    const selfie = formData.get('selfie') as File | null
    const ownershipFiles = formData.getAll('ownershipFiles') as File[]

    // Validate required fields
    const missingFields: string[] = []
    if (!vin) missingFields.push('vin')
    if (!registrationNumber) missingFields.push('registrationNumber')
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

    // Generate confirmation number
    const confirmationNumber = await generateConfirmationNumber()
    console.log('[SUBMIT] Starting submission for VIN:', vin, 'confirmation:', confirmationNumber)

    // Create Vehicle record — only core fields that always exist in DB
    let vehicle
    try {
      vehicle = await prisma.vehicle.create({
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
      console.log('[SUBMIT] Vehicle created:', vehicle.id)
    } catch (createErr) {
      console.error('[SUBMIT] Vehicle create failed:', createErr instanceof Error ? createErr.message : createErr)
      throw createErr
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
          licenceExpiry: licenceExpiry ? new Date(licenceExpiry) : new Date(),
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

    // Handle file uploads
    const useBlob = useBlobStorage()
    const uploadFile = async (
      file: File,
      category: string,
      vehId: string
    ): Promise<string> => {
      const buffer = Buffer.from(await file.arrayBuffer())
      let storagePath: string

      if (useBlob) {
        const result = await saveToBlobStorage(buffer, vehId, category, file.name, file.type)
        storagePath = result.storagePath
      } else {
        const result = saveFile(buffer, vehId, category, file.name, file.type)
        storagePath = result.storagePath
      }

      console.log('[SUBMIT] Uploaded file:', category, storagePath)

      const doc = await prisma.document.create({
        data: {
          vehicleId: vehId,
          category,
          originalName: file.name,
          storagePath,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      })
      return doc.id
    }

    let licenceFrontDocId: string | null = null
    let licenceBackDocId: string | null = null
    let selfieDocId: string | null = null

    try {
      if (licenceFront && licenceFront.size > 0) {
        licenceFrontDocId = await uploadFile(licenceFront, 'licence-front', vehicle.id)
      }
      if (licenceBack && licenceBack.size > 0) {
        licenceBackDocId = await uploadFile(licenceBack, 'licence-back', vehicle.id)
      }
      if (selfie && selfie.size > 0) {
        selfieDocId = await uploadFile(selfie, 'selfie', vehicle.id)
      }

      // Upload ownership files
      for (const file of ownershipFiles) {
        if (file && file.size > 0) {
          await uploadFile(file, 'ownership', vehicle.id)
        }
      }
      console.log('[SUBMIT] File uploads complete')
    } catch (uploadErr) {
      console.error('[SUBMIT] File upload failed (non-fatal):', uploadErr instanceof Error ? uploadErr.message : uploadErr)
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
          confirmationNumber,
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
        confirmationNumber,
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
          confirmationNumber,
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

    console.log('[SUBMIT] Success! Confirmation:', confirmationNumber)
    return NextResponse.json({
      confirmationNumber,
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
