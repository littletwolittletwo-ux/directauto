import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateBillOfSalePdf, type BillOfSalePdfData } from '@/lib/bill-of-sale-pdf'

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

// GET: Download signed Bill of Sale PDF (public, no auth)
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params

    const billOfSale = await prisma.billOfSale.findUnique({
      where: { signingToken: token },
      include: { vehicle: { select: { confirmationNumber: true, vin: true } } },
    })

    if (!billOfSale) {
      return NextResponse.json({ error: 'Invalid signing link.' }, { status: 404 })
    }

    if (billOfSale.status !== 'SIGNED') {
      return NextResponse.json({ error: 'Bill of Sale has not been signed yet.' }, { status: 400 })
    }

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
      signerName: billOfSale.signerName,
      signedAt: billOfSale.signedAt ? formatDateAEST(billOfSale.signedAt) : null,
      signerIp: billOfSale.signerIp,
      signatureData: billOfSale.signatureData,
      confirmationNumber: billOfSale.vehicle.confirmationNumber,
      generatedDate: formatDateAEST(new Date()),
    }

    const pdfBuffer = await generateBillOfSalePdf(pdfData)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Bill-of-Sale-Signed-${billOfSale.vehicle.vin}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[BILL_OF_SALE_PDF] Error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
