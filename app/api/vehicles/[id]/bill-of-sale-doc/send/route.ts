import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { sendBillOfSaleEmail } from '@/lib/mailer'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST: Send bill of sale to seller for signing
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userId = (session.user as Record<string, unknown>).id as string

    const billOfSale = await prisma.billOfSale.findUnique({
      where: { vehicleId: id },
      include: { vehicle: true },
    })

    if (!billOfSale) {
      return NextResponse.json({ error: 'Bill of Sale not found. Create one first.' }, { status: 404 })
    }

    if (billOfSale.status === 'SIGNED') {
      return NextResponse.json({ error: 'This Bill of Sale has already been signed.' }, { status: 400 })
    }

    // Generate new token (or refresh existing)
    const signingToken = randomUUID()
    const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const signingLink = `${baseUrl}/sign-bos/${signingToken}`

    const updated = await prisma.billOfSale.update({
      where: { vehicleId: id },
      data: {
        status: 'SENT',
        signingToken,
        tokenExpiresAt,
        sentAt: new Date(),
        sentById: userId,
      },
    })

    // Send email to seller
    const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })

    await sendBillOfSaleEmail({
      to: billOfSale.sellerEmail,
      sellerName: billOfSale.sellerFullName,
      year: billOfSale.yearOfManufacture,
      make: billOfSale.vehicleMake,
      model: billOfSale.vehicleModel,
      purchasePrice: billOfSale.purchasePrice,
      signingLink,
      dealershipName: settings?.dealershipName || 'Direct Auto Wholesale',
      contactEmail: settings?.contactEmail || undefined,
    })

    await prisma.billOfSaleEvent.create({
      data: {
        billOfSaleId: billOfSale.id,
        action: 'SENT',
        userId,
        details: { sellerEmail: billOfSale.sellerEmail, signingLink } as Prisma.InputJsonValue,
      },
    })

    await logAudit({
      vehicleId: id,
      userId,
      action: 'BILL_OF_SALE_SENT',
      details: { sellerEmail: billOfSale.sellerEmail } as Prisma.InputJsonValue,
    })

    return NextResponse.json({ billOfSale: updated, signingLink })
  } catch (error) {
    console.error('[BILL_OF_SALE_SEND] Error:', error)
    return NextResponse.json({ error: 'Failed to send Bill of Sale' }, { status: 500 })
  }
}
