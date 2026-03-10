import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getFilePath } from '@/lib/storage'
import fs from 'fs'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        vehicle: {
          select: { status: true },
        },
      },
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found.' },
        { status: 404 }
      )
    }

    // Auth check: authenticated users can access all documents
    // Unauthenticated users can only access documents for vehicles not yet APPROVED
    const session = await getServerSession(authOptions)
    if (!session) {
      if (document.vehicle.status === 'APPROVED') {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    const filePath = getFilePath(document.storagePath)

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found on disk.' },
        { status: 404 }
      )
    }

    const fileBuffer = fs.readFileSync(filePath)

    const headers = new Headers()
    headers.set('Content-Type', document.mimeType)
    headers.set(
      'Content-Disposition',
      `inline; filename="${document.originalName}"`
    )
    headers.set('Content-Length', String(fileBuffer.length))
    headers.set('Cache-Control', 'private, max-age=3600')

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('[DOCUMENT_GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve document.' },
      { status: 500 }
    )
  }
}
