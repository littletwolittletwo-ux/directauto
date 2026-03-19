import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runCarAnalysis } from '@/lib/autograb-client'

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

    console.log('[PPSR] Running Autograb Car Analysis — vin:', vin, 'rego:', rego, 'state:', state)

    const result = await runCarAnalysis({
      vin: vin || undefined,
      rego: rego || undefined,
      state: state || undefined,
      odometer: odometer ? Number(odometer) : undefined,
    })

    console.log('[PPSR] Car Analysis complete — stolen:', result.isStolen, 'writtenOff:', result.isWrittenOff, 'finance:', result.hasFinance, 'pdfUrl:', result.pdfUrl)

    return NextResponse.json({
      isWrittenOff: result.isWrittenOff,
      isStolen: result.isStolen,
      hasFinance: result.hasFinance,
      encumbered: result.encumbered,
      source: 'autograb',
      pdfUrl: result.pdfUrl,
      rawResult: result.rawResult,
    })
  } catch (error) {
    console.error('[PPSR] Autograb Car Analysis error:', error)
    const message = error instanceof Error ? error.message : 'PPSR check failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
