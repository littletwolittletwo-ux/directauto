import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateBillOfSalePdf, type BillOfSalePdfData } from '@/lib/bill-of-sale-pdf'

interface RouteParams {
  params: Promise<{ id: string }>
}

function formatDateAEST(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Melbourne',
  })
}

// GET: Download Bill of Sale PDF (admin only)
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const billOfSale = await prisma.billOfSale.findUnique({
      where: { vehicleId: id },
      include: { vehicle: true },
    })

    if (!billOfSale) {
      return NextResponse.json({ error: 'Bill of Sale not found' }, { status: 404 })
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
      isSigned: billOfSale.status === 'SIGNED',
      signerName: billOfSale.signerName,
      signedAt: billOfSale.signedAt ? formatDateAEST(billOfSale.signedAt) : null,
      signerIp: billOfSale.signerIp,
      signatureData: billOfSale.signatureData,
      confirmationNumber: billOfSale.vehicle.confirmationNumber,
      generatedDate: formatDateAEST(new Date()),
    }

    const pdfBuffer = await generateBillOfSalePdf(pdfData)
    const filename = billOfSale.status === 'SIGNED'
      ? `Bill-of-Sale-Signed-${billOfSale.vehicle.vin}.pdf`
      : `Bill-of-Sale-${billOfSale.vehicle.vin}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[BILL_OF_SALE_DOWNLOAD] Error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
