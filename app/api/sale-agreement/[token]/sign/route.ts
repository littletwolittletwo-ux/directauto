import { NextRequest, NextResponse } from 'next/server'

// Sale agreement feature disabled — DB columns not yet created
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: 'Sale agreement feature is not yet available.' },
    { status: 501 }
  )
}
