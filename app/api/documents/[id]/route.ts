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

    console.log('[DOCUMENT_GET] storagePath:', document.storagePath)

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

    const disposition = isDownload ? 'attachment' : 'inline'
    const contentType = document.mimeType || 'application/octet-stream'
    const fileName = document.originalName || 'download'

    // If storagePath is a blob URL, fetch server-side and stream back
    if (document.storagePath.startsWith('https://')) {
      console.log('[DOCUMENT_GET] Fetching from blob URL:', document.storagePath)
      const blobResponse = await fetch(document.storagePath)

      if (!blobResponse.ok) {
        console.error('[DOCUMENT_GET] Blob fetch failed:', blobResponse.status, blobResponse.statusText)
        return NextResponse.json(
          { error: 'Failed to fetch file from storage.' },
          { status: 502 }
        )
      }

      const headers = new Headers()
      headers.set('Content-Type', contentType)
      headers.set('Content-Disposition', `${disposition}; filename="${fileName}"`)
      headers.set('Cache-Control', 'private, max-age=3600')

      return new Response(blobResponse.body, { headers })
    }

    // Local filesystem fallback
    const filePath = getFilePath(document.storagePath)

    if (!fs.existsSync(filePath)) {
      console.log('[DOCUMENT_GET] File not found on disk:', filePath)
      return NextResponse.json(
        { error: 'File no longer available.' },
        { status: 404 }
      )
    }

    const fileBuffer = fs.readFileSync(filePath)

    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Content-Disposition', `${disposition}; filename="${fileName}"`)
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
