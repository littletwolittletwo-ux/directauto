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

export interface CarAnalysisResult {
  id: string
  status: string
  isWrittenOff: boolean
  isStolen: boolean
  hasFinance: boolean
  encumbered: boolean
  pdfUrl?: string
  rawResult?: Record<string, unknown>
}

function getApiKey(): string {
  const key = process.env.AUTOGRAB_API_KEY
  if (!key) {
    throw new Error('AUTOGRAB_API_KEY is not configured')
  }
  return key
}

function getBaseUrl(): string {
  return process.env.AUTOGRAB_BASE_URL || 'https://api.autograb.com.au'
}

export async function lookupByRego(rego: string, state: string): Promise<AutograbVehicle> {
  const apiKey = getApiKey()
  const base = getBaseUrl()
  const url = `${base}/v2/vehicles/registrations/${encodeURIComponent(rego)}?region=au&state=${encodeURIComponent(state)}`

  console.log('[AUTOGRAB] Lookup by rego:', rego, 'state:', state)

  const response = await fetch(url, {
    headers: { ApiKey: apiKey },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Autograb rego lookup failed: ${response.status} - ${text}`)
  }

  const data = await response.json()
  console.log('[AUTOGRAB] Rego lookup raw response:', JSON.stringify(data))
  return mapVehicleResponse(data)
}

export async function lookupByVIN(vin: string): Promise<AutograbVehicle> {
  const apiKey = getApiKey()
  const base = getBaseUrl()
  const url = `${base}/v2/vehicles/vins/${encodeURIComponent(vin)}?region=au`

  console.log('[AUTOGRAB] Lookup by VIN:', vin)

  const response = await fetch(url, {
    headers: { ApiKey: apiKey },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Autograb VIN lookup failed: ${response.status} - ${text}`)
  }

  const data = await response.json()
  console.log('[AUTOGRAB] VIN lookup raw response:', JSON.stringify(data))
  return mapVehicleResponse(data)
}

export async function getValuation(vehicleId: string, kms: number): Promise<AutograbValuation> {
  const apiKey = getApiKey()
  const base = getBaseUrl()
  const url = `${base}/v2/valuations/predict`

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
  console.log('[AUTOGRAB] Valuation raw response:', JSON.stringify(data))

  // Unwrap nested valuation response
  const v = (data.data && typeof data.data === 'object' ? data.data : data) as Record<string, unknown>
  console.log('[AUTOGRAB] Valuation keys:', Object.keys(v))

  return {
    trade_value: num(v.trade_value, v.trade, v.tradeValue, v.wholesale, v.wholesale_value, v.trade_low, v.trade_avg),
    retail_value: num(v.retail_value, v.retail, v.retailValue, v.retail_low, v.retail_avg, v.dealer_retail),
  }
}

function mapVehicleResponse(raw: Record<string, unknown>): AutograbVehicle {
  // Autograb may nest the vehicle data inside data, result, results[0], vehicle, etc.
  const d = unwrapResponse(raw)

  console.log('[AUTOGRAB] Unwrapped vehicle data keys:', Object.keys(d))

  const result = {
    vehicle_id: str(d.vehicle_id, d.vehicleId, d.id, d.autograb_id),
    make: str(d.make, d.Make),
    model: str(d.model, d.Model, d.family, d.Family),
    year: num(d.year, d.Year, d.year_of_manufacture, d.yearOfManufacture, d.build_year, d.buildYear),
    vin: str(d.vin, d.Vin, d.VIN, d.chassis_number, d.chassisNumber, d.chassis),
    registration_number: str(d.registration_number, d.registrationNumber, d.plate, d.Plate, d.rego, d.Rego, d.registration, d.plate_number, d.plateNumber),
    colour: str(d.colour, d.color, d.Colour, d.Color, d.exterior_colour, d.exteriorColour),
    engine: str(d.engine, d.Engine, d.engine_description, d.engineDescription, d.engine_type),
    transmission: str(d.transmission, d.Transmission, d.transmission_type, d.transmissionType, d.gearbox),
    body_type: str(d.body_type, d.bodyType, d.body_style, d.bodyStyle, d.BodyType, d.body, d.Body),
    odometer: num(d.odometer, d.Odometer, d.kms, d.km, d.mileage),
  }

  console.log('[AUTOGRAB] Mapped vehicle:', JSON.stringify(result))
  return result
}

function unwrapResponse(data: Record<string, unknown>): Record<string, unknown> {
  // Try common nesting patterns: data.data, data.result, data.results[0], data.vehicle
  for (const key of ['data', 'result', 'vehicle', 'item']) {
    const nested = data[key]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested as Record<string, unknown>
    }
  }

  for (const key of ['results', 'data', 'vehicles', 'items']) {
    const nested = data[key]
    if (Array.isArray(nested) && nested.length > 0 && typeof nested[0] === 'object') {
      return nested[0] as Record<string, unknown>
    }
  }

  // Check if the top-level response itself has vehicle fields
  if (data.make || data.vin || data.vehicle_id || data.year || data.VIN || data.Make) {
    return data
  }

  // Last resort: if there's a single nested object that looks like vehicle data, use it
  const values = Object.values(data)
  for (const val of values) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>
      if (obj.make || obj.vin || obj.year || obj.VIN || obj.Make) {
        return obj
      }
    }
  }

  return data
}

function str(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (c !== undefined && c !== null && c !== '') return String(c)
  }
  return ''
}

function num(...candidates: unknown[]): number {
  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      const n = Number(c)
      if (!isNaN(n) && n > 0) return n
    }
  }
  return 0
}

/**
 * Autograb Car Analysis — creates a report that includes PPSR check.
 * This is async: POST to create, then GET to retrieve after ~20s.
 */
export async function createCarAnalysis(params: {
  vin?: string
  rego?: string
  state?: string
  odometer?: number
}): Promise<string> {
  const apiKey = getApiKey()
  const base = getBaseUrl()
  const url = `${base}/v2/reports/car-analysis`

  const body: Record<string, unknown> = {
    sources: ['ppsr'],
    region: 'au',
  }
  if (params.vin) body.vin = params.vin
  if (params.rego) body.rego = params.rego
  if (params.state) body.state = params.state
  if (params.odometer) body.odometer = params.odometer

  console.log('[AUTOGRAB] Creating car analysis:', JSON.stringify(body))

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ApiKey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Autograb car analysis creation failed: ${response.status} - ${text}`)
  }

  const data = await response.json()
  const reportId = String(data.id ?? data.report_id ?? '')
  console.log('[AUTOGRAB] Car analysis created, id:', reportId)
  return reportId
}

export async function getCarAnalysisResult(reportId: string): Promise<CarAnalysisResult> {
  const apiKey = getApiKey()
  const base = getBaseUrl()
  const url = `${base}/v2/reports/car-analysis/${encodeURIComponent(reportId)}`

  console.log('[AUTOGRAB] Fetching car analysis result:', reportId)

  const response = await fetch(url, {
    headers: { ApiKey: apiKey },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Autograb car analysis fetch failed: ${response.status} - ${text}`)
  }

  const data = await response.json()
  console.log('[AUTOGRAB] Car analysis result:', JSON.stringify(data).slice(0, 1000))

  // Extract PPSR flags from the report data
  // The certificate/ppsr section contains the security flags
  const cert = (data.certificate ?? data.ppsr ?? data) as Record<string, unknown>
  const isStolen = Boolean(
    cert.has_stolen_records ?? cert.stolen ?? cert.is_stolen ?? false
  )
  const isWrittenOff = Boolean(
    cert.has_written_off_records ?? cert.written_off ?? cert.is_written_off ?? false
  )
  const hasFinance = Boolean(
    cert.has_secured_parties ?? cert.has_finance ?? cert.finance ?? cert.encumbered ?? false
  )

  return {
    id: reportId,
    status: String(data.status ?? 'completed'),
    isWrittenOff,
    isStolen,
    hasFinance,
    encumbered: hasFinance,
    pdfUrl: data.url ?? data.pdf_url ?? undefined,
    rawResult: data,
  }
}

/**
 * Run a full Car Analysis with polling.
 * Creates the report, waits, then retrieves the result.
 */
export async function runCarAnalysis(params: {
  vin?: string
  rego?: string
  state?: string
  odometer?: number
}): Promise<CarAnalysisResult> {
  const reportId = await createCarAnalysis(params)

  // Wait for report generation (Autograb recommends ~20s)
  await new Promise((resolve) => setTimeout(resolve, 20000))

  // Attempt to fetch — retry once if still processing
  try {
    return await getCarAnalysisResult(reportId)
  } catch (err) {
    console.log('[AUTOGRAB] First fetch attempt failed, retrying in 10s...', err)
    await new Promise((resolve) => setTimeout(resolve, 10000))
    return await getCarAnalysisResult(reportId)
  }
}
