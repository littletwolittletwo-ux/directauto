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
    const { searchParams } = new URL(request.url)
    const isDownload = searchParams.get('download') === 'true'

    console.log('[DOCUMENT_GET] Fetching document ID:', id)

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        vehicle: {
          select: { status: true },
        },
      },
    })

    if (!document) {
      console.log('[DOCUMENT_GET] Document not found:', id)
      return NextResponse.json(
        { error: 'Document not found.' },
        { status: 404 }
      )
    }

    console.log('[DOCUMENT_GET] Fetching doc:', document.storagePath)

    // Auth check: authenticated users can access all documents
    // Unauthenticated users can only access documents for vehicles not yet APPROVED
    const session = await getServerSession(authOptions)
    if (!session) {
      if (document.vehicle.status === 'APPROVED') {
        console.log('[DOCUMENT_GET] Unauthorized - vehicle is APPROVED and no session')
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    // If storagePath is a blob URL (Vercel Blob), redirect to it directly (public access)
    if (document.storagePath.startsWith('https://')) {
      console.log('[DOCUMENT_GET] Redirecting to blob URL:', document.storagePath)
      return NextResponse.redirect(document.storagePath, 302)
    }

    // Local filesystem fallback
    const filePath = getFilePath(document.storagePath)
    console.log('[DOCUMENT_GET] Local file path:', filePath)

    if (!fs.existsSync(filePath)) {
      console.log('[DOCUMENT_GET] File not found on disk:', filePath)
      return NextResponse.json(
        { error: 'File not found on disk.' },
        { status: 404 }
      )
    }

    const fileBuffer = fs.readFileSync(filePath)
    const disposition = isDownload ? 'attachment' : 'inline'

    const headers = new Headers()
    headers.set('Content-Type', document.mimeType)
    headers.set(
      'Content-Disposition',
      `${disposition}; filename="${document.originalName}"`
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
