import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { saveFile, saveToBlobStorage, useBlobStorage, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/storage'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const file = formData.get('file') as File | null
    const vehicleId = formData.get('vehicleId') as string | null
    const category = formData.get('category') as string | null

    if (!file || !vehicleId || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: file, vehicleId, category' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type: ${file.type}. Allowed types: JPEG, PNG, WebP, PDF.`,
        },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const maxMB = Math.round(MAX_FILE_SIZE / (1024 * 1024))
      return NextResponse.json(
        { error: `File too large. Maximum size is ${maxMB}MB.` },
        { status: 400 }
      )
    }

    // Verify vehicle exists
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
    })
    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found.' },
        { status: 404 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let storagePath: string

    if (useBlobStorage()) {
      // Upload to Vercel Blob (production)
      const result = await saveToBlobStorage(
        buffer,
        vehicleId,
        category,
        file.name,
        file.type
      )
      storagePath = result.storagePath
    } else {
      // Fallback to local filesystem (development)
      const result = saveFile(
        buffer,
        vehicleId,
        category,
        file.name,
        file.type
      )
      storagePath = result.storagePath
    }

    console.log('[DOCUMENT_UPLOAD] Stored at:', storagePath)

    // Create Document record — storagePath is the full blob URL when using Vercel Blob
    const doc = await prisma.document.create({
      data: {
        vehicleId,
        category,
        originalName: file.name,
        storagePath,
        mimeType: file.type,
        sizeBytes: file.size,
      },
    })

    console.log('[DOCUMENT_UPLOAD] DB record created:', doc.id, '| storagePath:', doc.storagePath)

    return NextResponse.json({
      documentId: doc.id,
      previewUrl: `/api/documents/${doc.id}`,
    })
  } catch (error) {
    console.error('[DOCUMENT_UPLOAD] Error:', error)
    return NextResponse.json(
      { error: 'Failed to upload document.' },
      { status: 500 }
    )
  }
}
