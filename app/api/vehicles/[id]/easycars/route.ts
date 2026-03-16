import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateCSV } from '@/lib/easycars-client'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET: Download CSV for EasyCars import
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const vehicle = await prisma.vehicle.findUnique({ where: { id } })
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    if (!vehicle.purchasePrice) {
      return NextResponse.json({ error: 'Purchase price not set' }, { status: 400 })
    }

    const csv = generateCSV({
      vin: vehicle.vin,
      registrationNumber: vehicle.registrationNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      odometer: vehicle.odometer,
      purchasePrice: vehicle.purchasePrice,
      sellerName: vehicle.sellerName,
      sellerPhone: vehicle.sellerPhone,
      sellerEmail: vehicle.sellerEmail,
    })

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="easycars-${vehicle.vin}.csv"`,
      },
    })
  } catch (error) {
    console.error('[EASYCARS_CSV] Error:', error)
    return NextResponse.json({ error: 'Failed to generate CSV' }, { status: 500 })
  }
}
