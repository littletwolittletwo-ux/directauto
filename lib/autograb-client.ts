/**
 * Autograb API client
 * Vehicle lookup by rego/VIN + valuation
 */

export interface AutograbVehicle {
  vehicle_id: string
  make: string
  model: string
  year: number
  vin: string
  registration_number: string
  colour: string
  engine: string
  transmission: string
  body_type: string
  odometer: number
}

export interface AutograbValuation {
  trade_value: number
  retail_value: number
}

function getApiKey(): string {
  const key = process.env.AUTOGRAB_API_KEY
  if (!key) {
    throw new Error('AUTOGRAB_API_KEY is not configured')
  }
  return key
}

export async function lookupByRego(rego: string, state: string): Promise<AutograbVehicle> {
  const apiKey = getApiKey()
  const url = `https://api.autograb.com.au/v2/vehicles/registrations/${encodeURIComponent(rego)}?region=au&state=${encodeURIComponent(state)}`

  console.log('[AUTOGRAB] Lookup by rego:', rego, 'state:', state)

  const response = await fetch(url, {
    headers: { ApiKey: apiKey },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Autograb rego lookup failed: ${response.status} - ${text}`)
  }

  const data = await response.json()
  console.log('[AUTOGRAB] Rego lookup result:', JSON.stringify(data).slice(0, 500))
  return mapVehicleResponse(data)
}

export async function lookupByVIN(vin: string): Promise<AutograbVehicle> {
  const apiKey = getApiKey()
  const url = `https://api.autograb.com.au/v2/vehicles/vins/${encodeURIComponent(vin)}?region=au`

  console.log('[AUTOGRAB] Lookup by VIN:', vin)

  const response = await fetch(url, {
    headers: { ApiKey: apiKey },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Autograb VIN lookup failed: ${response.status} - ${text}`)
  }

  const data = await response.json()
  console.log('[AUTOGRAB] VIN lookup result:', JSON.stringify(data).slice(0, 500))
  return mapVehicleResponse(data)
}

export async function getValuation(vehicleId: string, kms: number): Promise<AutograbValuation> {
  const apiKey = getApiKey()
  const url = 'https://api.autograb.com.au/v2/valuations/predict'

  console.log('[AUTOGRAB] Valuation for vehicle_id:', vehicleId, 'kms:', kms)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ApiKey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      region: 'au',
      vehicle_id: vehicleId,
      kms,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Autograb valuation failed: ${response.status} - ${text}`)
  }

  const data = await response.json()
  console.log('[AUTOGRAB] Valuation result:', JSON.stringify(data).slice(0, 500))

  return {
    trade_value: data.trade_value ?? data.trade ?? 0,
    retail_value: data.retail_value ?? data.retail ?? 0,
  }
}

function mapVehicleResponse(data: Record<string, unknown>): AutograbVehicle {
  return {
    vehicle_id: String(data.vehicle_id ?? data.id ?? ''),
    make: String(data.make ?? ''),
    model: String(data.model ?? ''),
    year: Number(data.year ?? data.year_of_manufacture ?? 0),
    vin: String(data.vin ?? ''),
    registration_number: String(data.registration_number ?? data.plate ?? ''),
    colour: String(data.colour ?? data.color ?? ''),
    engine: String(data.engine ?? data.engine_description ?? ''),
    transmission: String(data.transmission ?? ''),
    body_type: String(data.body_type ?? data.body_style ?? ''),
    odometer: Number(data.odometer ?? data.kms ?? 0),
  }
}
