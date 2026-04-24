import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateInvoice } from '@/lib/invoice-service'
import { ApprovalRequiredError } from '@/lib/approval'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET — list invoices for a vehicle
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const invoices = await prisma.applicationInvoice.findMany({
      where: { vehicleId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(invoices)
  } catch (error) {
    console.error('[INVOICES_LIST] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch invoices.' }, { status: 500 })
  }
}

// POST — generate a new invoice
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userId = (session.user as Record<string, unknown>).id as string
    const body = await request.json()

    const { salePrice, buyerName, buyerEmail, buyerAddress } = body

    if (!salePrice || !buyerName || !buyerEmail) {
      return NextResponse.json(
        { error: 'salePrice, buyerName, and buyerEmail are required.' },
        { status: 400 }
      )
    }

    const invoice = await generateInvoice({
      vehicleId: id,
      userId,
      salePrice: Number(salePrice),
      buyerName,
      buyerEmail,
      buyerAddress,
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    if (error instanceof ApprovalRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[INVOICE_GENERATE] Error:', error)
    return NextResponse.json({ error: 'Failed to generate invoice.' }, { status: 500 })
  }
}
