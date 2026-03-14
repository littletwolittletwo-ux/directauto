import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'

// Debug route: GET /api/debug/blob-test — tests Vercel Blob connectivity
export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  const hasBlobToken = !!token

  const tokenType = token
    ? token.startsWith('vercel_blob_rw_') ? 'public_store' : 'private_or_unknown'
    : 'none'

  if (!hasBlobToken) {
    return NextResponse.json({
      hasBlobToken: false,
      tokenType,
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
      tokenType,
      tokenLength: token!.length,
      tokenPrefix: token!.substring(0, 20) + '...',
      uploadSuccess: true,
      blobUrl: blob.url,
      error: '',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const hint = message.includes('public')
      ? ' — Your blob store is private. Delete it on Vercel dashboard (Storage tab) and recreate as a PUBLIC store.'
      : tokenType === 'private_or_unknown'
        ? ' — Token does not start with vercel_blob_rw_ which suggests a private store. Recreate as public.'
        : ''
    return NextResponse.json({
      hasBlobToken: true,
      tokenType,
      tokenLength: token!.length,
      tokenPrefix: token!.substring(0, 20) + '...',
      uploadSuccess: false,
      blobUrl: '',
      error: message + hint,
    })
  }
}
