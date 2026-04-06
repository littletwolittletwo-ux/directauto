import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET: Fetch bill of sale for a vehicle
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const billOfSale = await prisma.billOfSale.findUnique({
      where: { vehicleId: id },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 20 } },
    })

    return NextResponse.json(billOfSale)
  } catch (error) {
    console.error('[BILL_OF_SALE_DOC] GET error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST: Create or update bill of sale
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userId = (session.user as Record<string, unknown>).id as string
    const body = await request.json()

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      include: { identity: true },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Build data from body + vehicle defaults
    const data = {
      vehicleId: id,
      // Seller details
      sellerFullName: body.sellerFullName || vehicle.identity?.fullLegalName || vehicle.sellerName,
      sellerAddress: body.sellerAddress || vehicle.identity?.address || null,
      sellerSuburb: body.sellerSuburb || null,
      sellerState: body.sellerState || vehicle.identity?.licenceState || null,
      sellerPostcode: body.sellerPostcode || null,
      sellerCustomerId: body.sellerCustomerId || null,
      sellerDob: body.sellerDob || null,
      sellerPhone: body.sellerPhone || vehicle.sellerPhone,
      sellerEmail: body.sellerEmail || vehicle.sellerEmail,
      sellerLicenceNumber: body.sellerLicenceNumber || vehicle.identity?.driversLicenceNumber || null,
      // Vehicle details
      registrationNumber: body.registrationNumber || vehicle.registrationNumber,
      stateOfRegistration: body.stateOfRegistration || null,
      vinNumber: body.vinNumber || vehicle.vin,
      engineNumber: body.engineNumber || vehicle.autograbEngine || null,
      yearOfManufacture: body.yearOfManufacture || vehicle.year,
      vehicleMake: body.vehicleMake || vehicle.make,
      vehicleModel: body.vehicleModel || vehicle.model,
      vehicleVariant: body.vehicleVariant || null,
      bodyType: body.bodyType || vehicle.autograbBodyType || null,
      colour: body.colour || vehicle.autograbColour || null,
      fuelType: body.fuelType || null,
      transmission: body.transmission || vehicle.autograbTransmission || null,
      odometerReading: body.odometerReading || vehicle.odometer,
      numberOfKeys: body.numberOfKeys || null,
      // Sale details
      purchasePrice: parseFloat(body.purchasePrice) || vehicle.purchasePrice || 0,
      depositPaid: parseFloat(body.depositPaid) || 0,
      balanceDue: parseFloat(body.balanceDue) || (parseFloat(body.purchasePrice) || vehicle.purchasePrice || 0) - (parseFloat(body.depositPaid) || 0),
      paymentMethod: body.paymentMethod || null,
      dateOfSale: body.dateOfSale ? new Date(body.dateOfSale) : new Date(),
      // Condition
      knownDefects: body.knownDefects || null,
      notes: body.notes || null,
    }

    if (!data.purchasePrice) {
      return NextResponse.json({ error: 'Purchase price is required' }, { status: 400 })
    }

    // Check if exists
    const existing = await prisma.billOfSale.findUnique({ where: { vehicleId: id } })

    let billOfSale
    if (existing) {
      // Don't allow editing if already signed
      if (existing.status === 'SIGNED' && !body.forceUpdate) {
        return NextResponse.json({ error: 'Cannot edit a signed Bill of Sale' }, { status: 400 })
      }

      billOfSale = await prisma.billOfSale.update({
        where: { vehicleId: id },
        data,
      })

      await prisma.billOfSaleEvent.create({
        data: {
          billOfSaleId: billOfSale.id,
          action: 'UPDATED',
          userId,
          details: { fields: Object.keys(body) } as Prisma.InputJsonValue,
        },
      })
    } else {
      billOfSale = await prisma.billOfSale.create({
        data: {
          ...data,
          signingToken: randomUUID(),
          tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      await prisma.billOfSaleEvent.create({
        data: {
          billOfSaleId: billOfSale.id,
          action: 'CREATED',
          userId,
        },
      })
    }

    await logAudit({
      vehicleId: id,
      userId,
      action: existing ? 'BILL_OF_SALE_UPDATED' : 'BILL_OF_SALE_CREATED',
      details: { purchasePrice: data.purchasePrice } as Prisma.InputJsonValue,
    })

    return NextResponse.json(billOfSale)
  } catch (error) {
    console.error('[BILL_OF_SALE_DOC] POST error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
