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
  console.log('[AUTOGRAB] Rego lookup result:', JSON.stringify(data).slice(0, 500))
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
  console.log('[AUTOGRAB] VIN lookup result:', JSON.stringify(data).slice(0, 500))
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
