import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'

// Debug route: GET /api/debug/blob-test — tests Vercel Blob connectivity
export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  const hasBlobToken = !!token

  if (!hasBlobToken) {
    return NextResponse.json({
      hasBlobToken: false,
      tokenLength: 0,
      uploadSuccess: false,
      blobUrl: '',
      error: 'BLOB_READ_WRITE_TOKEN is not set in environment variables',
    })
  }

  try {
    const testContent = `Blob storage test - ${new Date().toISOString()}`
    const blob = await put('debug/test.txt', testContent, {
      access: 'public',
      contentType: 'text/plain',
      token,
      addRandomSuffix: false,
    })

    return NextResponse.json({
      hasBlobToken: true,
      tokenLength: token!.length,
      tokenPrefix: token!.substring(0, 12) + '...',
      uploadSuccess: true,
      blobUrl: blob.url,
      error: '',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const hint = message.includes('public')
      ? ' — Your blob store may be configured as private. Delete it on Vercel and recreate as a public store.'
      : ''
    return NextResponse.json({
      hasBlobToken: true,
      tokenLength: token!.length,
      tokenPrefix: token!.substring(0, 12) + '...',
      uploadSuccess: false,
      blobUrl: '',
      error: message + hint,
    })
  }
}
