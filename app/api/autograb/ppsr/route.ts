import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runCarAnalysis } from '@/lib/autograb-client'
import { searchByVIN } from '@/lib/ppsr-client'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { vin, rego, state, odometer } = body

    if (!vin && !rego) {
      return NextResponse.json({ error: 'VIN or rego is required' }, { status: 400 })
    }

    // Try Autograb Car Analysis first (includes PPSR)
    try {
      console.log('[PPSR] Attempting Autograb Car Analysis...')
      const result = await runCarAnalysis({
        vin: vin || undefined,
        rego: rego || undefined,
        state: state || undefined,
        odometer: odometer ? Number(odometer) : undefined,
      })

      return NextResponse.json({
        isWrittenOff: result.isWrittenOff,
        isStolen: result.isStolen,
        hasFinance: result.hasFinance,
        encumbered: result.encumbered,
        source: 'autograb',
        pdfUrl: result.pdfUrl,
        rawResult: result.rawResult,
      })
    } catch (autograbErr) {
      console.error('[PPSR] Autograb Car Analysis failed, falling back to PPSR Cloud:', autograbErr)
    }

    // Fallback to PPSR Cloud (requires VIN)
    if (vin && vin.length === 17) {
      console.log('[PPSR] Falling back to PPSR Cloud...')
      const result = await searchByVIN(vin)
      return NextResponse.json({
        isWrittenOff: result.isWrittenOff,
        isStolen: result.isStolen,
        hasFinance: result.hasFinance,
        encumbered: result.encumbered,
        source: 'ppsr-cloud',
      })
    }

    return NextResponse.json(
      { error: 'PPSR check failed. Autograb Car Analysis unavailable and no valid VIN for PPSR Cloud fallback.' },
      { status: 500 }
    )
  } catch (error) {
    console.error('[PPSR_STANDALONE] Error:', error)
    const message = error instanceof Error ? error.message : 'PPSR check failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
