import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { searchByVIN } from '@/lib/ppsr-client'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { vin } = body

    if (!vin || vin.length !== 17) {
      return NextResponse.json({ error: 'Valid 17-character VIN is required' }, { status: 400 })
    }

    const result = await searchByVIN(vin)

    return NextResponse.json({
      isWrittenOff: result.isWrittenOff,
      isStolen: result.isStolen,
      hasFinance: result.hasFinance,
      encumbered: result.encumbered,
    })
  } catch (error) {
    console.error('[PPSR_STANDALONE] Error:', error)
    const message = error instanceof Error ? error.message : 'PPSR check failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
