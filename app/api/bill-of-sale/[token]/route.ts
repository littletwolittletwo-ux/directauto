import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { generateBillOfSalePdf, type BillOfSalePdfData } from '@/lib/bill-of-sale-pdf'
import { sendBillOfSaleConfirmation } from '@/lib/mailer'
import { saveToBlobStorage, saveFile, useBlobStorage } from '@/lib/storage'
import { Prisma } from '@prisma/client'

interface RouteParams {
  params: Promise<{ token: string }>
}

function formatDateAEST(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Melbourne',
  })
}

// GET: Fetch bill of sale by signing token (public, no auth)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params

    const billOfSale = await prisma.billOfSale.findUnique({
      where: { signingToken: token },
      include: { vehicle: { select: { confirmationNumber: true } } },
    })

    if (!billOfSale) {
      return NextResponse.json({ error: 'Invalid or expired signing link.' }, { status: 404 })
    }

    // Check token expiry
    if (billOfSale.tokenExpiresAt && new Date() > billOfSale.tokenExpiresAt) {
      return NextResponse.json({ error: 'This signing link has expired. Please contact Direct Auto for a new link.' }, { status: 410 })
    }

    // Record view event if first view
    if (!billOfSale.viewedAt) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
      await prisma.billOfSale.update({
        where: { signingToken: token },
        data: { viewedAt: new Date(), status: billOfSale.status === 'SENT' ? 'VIEWED' : billOfSale.status },
      })
      await prisma.billOfSaleEvent.create({
        data: {
          billOfSaleId: billOfSale.id,
          action: 'VIEWED',
          ipAddress: ip,
          userAgent: request.headers.get('user-agent') || undefined,
        },
      })
    }

    if (billOfSale.status === 'SIGNED') {
      return NextResponse.json({
        status: 'SIGNED',
        signerName: billOfSale.signerName,
        signedAt: billOfSale.signedAt,
        sellerFullName: billOfSale.sellerFullName,
        vehicleMake: billOfSale.vehicleMake,
        vehicleModel: billOfSale.vehicleModel,
        yearOfManufacture: billOfSale.yearOfManufacture,
        purchasePrice: billOfSale.purchasePrice,
        confirmationNumber: billOfSale.vehicle.confirmationNumber,
      })
    }

    // Return full bill of sale data for review
    return NextResponse.json({
      status: billOfSale.status,
      // Seller
      sellerFullName: billOfSale.sellerFullName,
      sellerAddress: billOfSale.sellerAddress,
      sellerSuburb: billOfSale.sellerSuburb,
      sellerState: billOfSale.sellerState,
      sellerPostcode: billOfSale.sellerPostcode,
      sellerPhone: billOfSale.sellerPhone,
      sellerEmail: billOfSale.sellerEmail,
      sellerLicenceNumber: billOfSale.sellerLicenceNumber,
      sellerDob: billOfSale.sellerDob,
      sellerCustomerId: billOfSale.sellerCustomerId,
      // Vehicle
      registrationNumber: billOfSale.registrationNumber,
      stateOfRegistration: billOfSale.stateOfRegistration,
      vinNumber: billOfSale.vinNumber,
      engineNumber: billOfSale.engineNumber,
      yearOfManufacture: billOfSale.yearOfManufacture,
      vehicleMake: billOfSale.vehicleMake,
      vehicleModel: billOfSale.vehicleModel,
      vehicleVariant: billOfSale.vehicleVariant,
      bodyType: billOfSale.bodyType,
      colour: billOfSale.colour,
      fuelType: billOfSale.fuelType,
      transmission: billOfSale.transmission,
      odometerReading: billOfSale.odometerReading,
      numberOfKeys: billOfSale.numberOfKeys,
      // Sale
      purchasePrice: billOfSale.purchasePrice,
      depositPaid: billOfSale.depositPaid,
      balanceDue: billOfSale.balanceDue,
      paymentMethod: billOfSale.paymentMethod,
      dateOfSale: billOfSale.dateOfSale,
      // Condition
      knownDefects: billOfSale.knownDefects,
      // Meta
      confirmationNumber: billOfSale.vehicle.confirmationNumber,
    })
  } catch (err) {
    console.error('[BILL_OF_SALE_TOKEN] GET error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST: Submit seller signature (public, no auth)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const body = await request.json()
    const { signerName, signatureData } = body

    if (!signerName || typeof signerName !== 'string' || signerName.trim().length < 2) {
      return NextResponse.json({ error: 'Please provide your full legal name.' }, { status: 400 })
    }

    const billOfSale = await prisma.billOfSale.findUnique({
      where: { signingToken: token },
      include: { vehicle: true },
    })

    if (!billOfSale) {
      return NextResponse.json({ error: 'Invalid signing link.' }, { status: 404 })
    }

    if (billOfSale.tokenExpiresAt && new Date() > billOfSale.tokenExpiresAt) {
      return NextResponse.json({ error: 'This signing link has expired.' }, { status: 410 })
    }

    if (billOfSale.status === 'SIGNED') {
      return NextResponse.json({ error: 'This Bill of Sale has already been signed.' }, { status: 410 })
    }

    // Capture signing metadata
    const forwarded = request.headers.get('x-forwarded-for')
    const signerIp = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const signerUserAgent = request.headers.get('user-agent') || 'unknown'

    // Update bill of sale
    const updated = await prisma.billOfSale.update({
      where: { signingToken: token },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
        signerName: signerName.trim(),
        signerIp,
        signerUserAgent,
        signatureData: signatureData || null,
      },
    })

    // Record signing event
    await prisma.billOfSaleEvent.create({
      data: {
        billOfSaleId: billOfSale.id,
        action: 'SIGNED',
        ipAddress: signerIp,
        userAgent: signerUserAgent,
        details: { signerName: signerName.trim() } as Prisma.InputJsonValue,
      },
    })

    await logAudit({
      vehicleId: billOfSale.vehicleId,
      action: 'BILL_OF_SALE_SIGNED',
      details: {
        signerName: signerName.trim(),
        signerIp,
        purchasePrice: billOfSale.purchasePrice,
      } as Prisma.InputJsonValue,
      ipAddress: signerIp,
    })

    // Generate signed PDF
    try {
      const pdfData: BillOfSalePdfData = {
        sellerFullName: billOfSale.sellerFullName,
        sellerAddress: billOfSale.sellerAddress,
        sellerSuburb: billOfSale.sellerSuburb,
        sellerState: billOfSale.sellerState,
        sellerPostcode: billOfSale.sellerPostcode,
        sellerCustomerId: billOfSale.sellerCustomerId,
        sellerDob: billOfSale.sellerDob,
        sellerPhone: billOfSale.sellerPhone,
        sellerEmail: billOfSale.sellerEmail,
        sellerLicenceNumber: billOfSale.sellerLicenceNumber,
        registrationNumber: billOfSale.registrationNumber,
        stateOfRegistration: billOfSale.stateOfRegistration,
        vinNumber: billOfSale.vinNumber,
        engineNumber: billOfSale.engineNumber,
        yearOfManufacture: billOfSale.yearOfManufacture,
        vehicleMake: billOfSale.vehicleMake,
        vehicleModel: billOfSale.vehicleModel,
        vehicleVariant: billOfSale.vehicleVariant,
        bodyType: billOfSale.bodyType,
        colour: billOfSale.colour,
        fuelType: billOfSale.fuelType,
        transmission: billOfSale.transmission,
        odometerReading: billOfSale.odometerReading,
        numberOfKeys: billOfSale.numberOfKeys,
        purchasePrice: billOfSale.purchasePrice,
        depositPaid: billOfSale.depositPaid,
        balanceDue: billOfSale.balanceDue,
        paymentMethod: billOfSale.paymentMethod,
        dateOfSale: formatDateAEST(billOfSale.dateOfSale),
        knownDefects: billOfSale.knownDefects,
        isSigned: true,
        signerName: signerName.trim(),
        signedAt: formatDateAEST(updated.signedAt!),
        signerIp,
        signatureData: signatureData || null,
        confirmationNumber: billOfSale.vehicle.confirmationNumber,
        generatedDate: formatDateAEST(new Date()),
      }

      const pdfBuffer = await generateBillOfSalePdf(pdfData)

      // Save PDF to storage
      const fileName = `bill-of-sale-signed-${billOfSale.vehicle.vin}.pdf`
      let storagePath: string

      if (useBlobStorage()) {
        const result = await saveToBlobStorage(
          pdfBuffer,
          billOfSale.vehicleId,
          'bill-of-sale-signed',
          fileName,
          'application/pdf'
        )
        storagePath = result.storagePath
      } else {
        const result = saveFile(
          pdfBuffer,
          billOfSale.vehicleId,
          'bill-of-sale-signed',
          fileName,
          'application/pdf'
        )
        storagePath = result.storagePath
      }

      // Update PDF path
      await prisma.billOfSale.update({
        where: { id: billOfSale.id },
        data: { pdfStoragePath: storagePath },
      })

      // Create document record
      await prisma.document.create({
        data: {
          vehicleId: billOfSale.vehicleId,
          category: 'bill-of-sale-signed',
          originalName: fileName,
          storagePath,
          mimeType: 'application/pdf',
          sizeBytes: pdfBuffer.length,
        },
      })

      // Send confirmation email with PDF
      const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
      await sendBillOfSaleConfirmation({
        to: billOfSale.sellerEmail,
        sellerName: billOfSale.sellerFullName,
        year: billOfSale.yearOfManufacture,
        make: billOfSale.vehicleMake,
        model: billOfSale.vehicleModel,
        purchasePrice: billOfSale.purchasePrice,
        dealershipName: settings?.dealershipName || 'Direct Auto Wholesale',
        contactEmail: settings?.contactEmail || undefined,
        pdfBuffer,
        pdfFilename: fileName,
      })
    } catch (pdfErr) {
      console.error('[BILL_OF_SALE_TOKEN] PDF generation/email error (non-fatal):', pdfErr)
    }

    return NextResponse.json({
      success: true,
      signedAt: updated.signedAt,
      pdfUrl: `/api/bill-of-sale/${token}/pdf`,
    })
  } catch (err) {
    console.error('[BILL_OF_SALE_TOKEN] POST error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
