import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  return new NextResponse('DocuSign connected successfully. You can close this tab.', {
    status: 200
  })
}
