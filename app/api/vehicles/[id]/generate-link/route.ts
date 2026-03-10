import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { randomUUID } from 'crypto'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found.' },
        { status: 404 }
      )
    }

    // Create a unique token
    const token = randomUUID()

    // Set expiry to 7 days from now
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Create SubmissionToken record
    const submissionToken = await prisma.submissionToken.create({
      data: {
        token,
        vehicleVin: vehicle.vin,
        expiresAt,
      },
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const url = `${baseUrl}/submit/${token}`

    // Log audit
    await logAudit({
      vehicleId: id,
      userId: (session.user as Record<string, unknown>).id as string,
      action: 'LINK_GENERATED',
      details: {
        tokenId: submissionToken.id,
        expiresAt: expiresAt.toISOString(),
        url,
      } as Prisma.InputJsonValue,
    })

    return NextResponse.json({
      token,
      url,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('[GENERATE_LINK] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate submission link.' },
      { status: 500 }
    )
  }
}
