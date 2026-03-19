import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { lookupByRego, lookupByVIN, getValuation } from '@/lib/autograb-client'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { query, state, type, odometer } = body

    if (!query) {
      return NextResponse.json({ error: 'Query (VIN or Rego) is required' }, { status: 400 })
    }

    // Look up vehicle
    let vehicle
    if (type === 'vin' || query.length === 17) {
      vehicle = await lookupByVIN(query.toUpperCase())
    } else {
      if (!state) {
        return NextResponse.json({ error: 'State is required for rego lookup' }, { status: 400 })
      }
      vehicle = await lookupByRego(query.toUpperCase(), state)
    }

    // Get valuation — use provided odometer if available, else Autograb's value
    const kms = odometer ? Number(odometer) : (vehicle.odometer || 0)
    let valuation = { trade_value: 0, retail_value: 0 }
    if (vehicle.vehicle_id) {
      try {
        valuation = await getValuation(vehicle.vehicle_id, kms)
      } catch (err) {
        console.error('[AUTOGRAB] Valuation failed (non-fatal):', err)
      }
    }

    console.log('[AUTOGRAB] Final vehicle to frontend:', JSON.stringify(vehicle))
    console.log('[AUTOGRAB] Final valuation to frontend:', JSON.stringify(valuation))
    console.log('[AUTOGRAB] Key fields — vin:', vehicle.vin, '| colour:', vehicle.colour, '| trade:', valuation.trade_value, '| retail:', valuation.retail_value)

    return NextResponse.json({
      vehicle,
      valuation,
    })
  } catch (error) {
    console.error('[AUTOGRAB] Error:', error)
    const message = error instanceof Error ? error.message : 'Autograb lookup failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
