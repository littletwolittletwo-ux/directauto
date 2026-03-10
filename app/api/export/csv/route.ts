import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/* eslint-disable @typescript-eslint/no-explicit-any */

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const source = searchParams.get('source')
    const riskLevel = searchParams.get('riskLevel')
    const search = searchParams.get('search')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Build where clause (same as vehicles list)
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (source) {
      where.submissionSource = source
    }

    if (riskLevel) {
      switch (riskLevel) {
        case 'low':
          where.riskScore = { lte: 20 }
          break
        case 'medium':
          where.riskScore = { gt: 20, lte: 50 }
          break
        case 'high':
          where.riskScore = { gt: 50 }
          break
      }
    }

    if (search) {
      where.OR = [
        { vin: { contains: search, mode: 'insensitive' } },
        { registrationNumber: { contains: search, mode: 'insensitive' } },
        { sellerName: { contains: search, mode: 'insensitive' } },
        { confirmationNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (dateFrom || dateTo) {
      where.submittedAt = {} as any
      if (dateFrom) {
        where.submittedAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.submittedAt.lte = new Date(dateTo)
      }
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
    })

    // Build CSV
    const headers = [
      'Ref#',
      'VIN',
      'Rego',
      'Make',
      'Model',
      'Year',
      'Odometer',
      'Seller',
      'Phone',
      'Email',
      'Status',
      'Risk Score',
      'Source',
      'Submitted',
    ]

    const rows = vehicles.map((v: any) => [
      escapeCSV(v.confirmationNumber),
      escapeCSV(v.vin),
      escapeCSV(v.registrationNumber),
      escapeCSV(v.make),
      escapeCSV(v.model),
      escapeCSV(v.year),
      escapeCSV(v.odometer),
      escapeCSV(v.sellerName),
      escapeCSV(v.sellerPhone),
      escapeCSV(v.sellerEmail),
      escapeCSV(v.status.replace(/_/g, ' ')),
      escapeCSV(v.riskScore),
      escapeCSV(v.submissionSource.replace(/_/g, ' ')),
      escapeCSV(v.submittedAt.toISOString().split('T')[0]),
    ])

    const csv = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\r\n')

    const timestamp = new Date().toISOString().split('T')[0]
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="vehicles-export-${timestamp}.csv"`,
      },
    })
  } catch (error) {
    console.error('[CSV_EXPORT] Error:', error)
    return NextResponse.json(
      { error: 'Failed to export CSV.' },
      { status: 500 }
    )
  }
}
