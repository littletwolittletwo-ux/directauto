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

  // Unwrap nested valuation response — try multiple nesting patterns
  let v = data as Record<string, unknown>
  for (const key of ['data', 'result', 'valuation', 'prediction', 'predictions', 'values', 'pricing']) {
    const nested = v[key]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      v = nested as Record<string, unknown>
      break
    }
  }
  console.log('[AUTOGRAB] Valuation unwrapped keys:', Object.keys(v))
  console.log('[AUTOGRAB] Valuation trade candidates:', JSON.stringify({
    trade_value: v.trade_value, trade: v.trade, wholesale: v.wholesale,
    trade_low: v.trade_low, trade_avg: v.trade_avg, predicted_trade: v.predicted_trade,
    wholesale_value: v.wholesale_value, trade_price: v.trade_price,
  }))
  console.log('[AUTOGRAB] Valuation retail candidates:', JSON.stringify({
    retail_value: v.retail_value, retail: v.retail, dealer_retail: v.dealer_retail,
    retail_low: v.retail_low, retail_avg: v.retail_avg, predicted_retail: v.predicted_retail,
    retail_price: v.retail_price, private_value: v.private_value,
  }))

  return {
    trade_value: num(v.trade_value, v.trade, v.tradeValue, v.wholesale, v.wholesale_value, v.wholesaleValue, v.trade_low, v.trade_avg, v.predicted_trade, v.predictedTrade, v.trade_price, v.tradePrice),
    retail_value: num(v.retail_value, v.retail, v.retailValue, v.retail_low, v.retail_avg, v.dealer_retail, v.dealerRetail, v.predicted_retail, v.predictedRetail, v.retail_price, v.retailPrice, v.private_value, v.privateValue),
  }
}

function mapVehicleResponse(raw: Record<string, unknown>): AutograbVehicle {
  // Autograb may nest the vehicle data inside data, result, results[0], vehicle, etc.
  const d = unwrapResponse(raw)

  console.log('[AUTOGRAB] Unwrapped vehicle data keys:', Object.keys(d))
  // Log values for critical fields to debug mapping
  console.log('[AUTOGRAB] VIN candidates:', JSON.stringify({ vin: d.vin, vins: d.vins, VIN: d.VIN, chassis_number: d.chassis_number, chassis: d.chassis }))
  console.log('[AUTOGRAB] Colour candidates:', JSON.stringify({ colour: d.colour, color: d.color, exterior_colour: d.exterior_colour, exterior_color: d.exterior_color, primary_colour: d.primary_colour }))

  const result = {
    vehicle_id: str(d.vehicle_id, d.vehicleId, d.id, d.autograb_id, d.autograbId),
    make: strObj(d.make, d.Make, d.manufacturer, d.Manufacturer),
    model: strObj(d.model, d.Model, d.family, d.Family, d.variant, d.Variant),
    year: num(d.year, d.Year, d.year_of_manufacture, d.yearOfManufacture, d.build_year, d.buildYear, d.manufacture_year),
    vin: strArr(d.vin, d.vins, d.Vin, d.VIN, d.chassis_number, d.chassisNumber, d.chassis, d.Chassis, d.vin_number, d.vinNumber),
    registration_number: strObj(d.registration_number, d.registrationNumber, d.plate, d.Plate, d.rego, d.Rego, d.registration, d.plate_number, d.plateNumber, d.plates, d.number_plate),
    colour: strObj(d.colour, d.color, d.Colour, d.Color, d.exterior_colour, d.exteriorColour, d.exterior_color, d.exteriorColor, d.primary_colour, d.primaryColour, d.primary_color),
    engine: strObj(d.engine, d.Engine, d.engine_description, d.engineDescription, d.engine_type, d.engineType),
    transmission: strObj(d.transmission, d.Transmission, d.transmission_type, d.transmissionType, d.gearbox, d.Gearbox, d.gear_type),
    body_type: strObj(d.body_type, d.bodyType, d.body_style, d.bodyStyle, d.BodyType, d.body, d.Body, d.body_configuration),
    odometer: num(d.odometer, d.Odometer, d.kms, d.km, d.mileage, d.Mileage, d.kilometres),
  }

  console.log('[AUTOGRAB] Mapped vehicle:', JSON.stringify(result))
  return result
}

function unwrapResponse(data: Record<string, unknown>): Record<string, unknown> {
  console.log('[AUTOGRAB] unwrapResponse top-level keys:', Object.keys(data))

  // If top-level already has vehicle fields, use it directly
  if (data.make || data.vin || data.vins || data.vehicle_id || data.year || data.VIN || data.Make) {
    console.log('[AUTOGRAB] unwrapResponse: top-level has vehicle fields, using directly')
    return data
  }

  // Try common nesting patterns: data.data, data.result, data.results[0], data.vehicle
  for (const key of ['data', 'result', 'vehicle', 'item']) {
    const nested = data[key]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const obj = nested as Record<string, unknown>
      console.log('[AUTOGRAB] unwrapResponse: found nested object at "' + key + '", keys:', Object.keys(obj))
      // Check if this level has vehicle fields, or if we need to go deeper
      if (obj.make || obj.vin || obj.vins || obj.vehicle_id || obj.year || obj.VIN || obj.Make) {
        return obj
      }
      // Go one level deeper
      for (const innerKey of ['data', 'result', 'vehicle', 'item']) {
        const inner = obj[innerKey]
        if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
          console.log('[AUTOGRAB] unwrapResponse: going deeper into "' + key + '.' + innerKey + '"')
          return inner as Record<string, unknown>
        }
      }
      // If no deeper level, use this level anyway
      return obj
    }
  }

  for (const key of ['results', 'data', 'vehicles', 'items']) {
    const nested = data[key]
    if (Array.isArray(nested) && nested.length > 0 && typeof nested[0] === 'object') {
      console.log('[AUTOGRAB] unwrapResponse: found array at "' + key + '", using first element')
      return nested[0] as Record<string, unknown>
    }
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

/**
 * Like str() but also handles arrays (take first element) and
 * objects with name/primary/value/number keys.
 */
function strArr(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (c === undefined || c === null || c === '') continue
    if (Array.isArray(c)) {
      if (c.length > 0 && c[0] !== null && c[0] !== undefined && c[0] !== '') {
        return String(c[0])
      }
      continue
    }
    if (typeof c === 'object') {
      const obj = c as Record<string, unknown>
      // Try common object shapes: {number: "X"}, {value: "X"}, {name: "X"}
      const val = obj.value ?? obj.name ?? obj.number ?? obj.primary ?? Object.values(obj)[0]
      if (val !== undefined && val !== null && val !== '') return String(val)
      continue
    }
    return String(c)
  }
  return ''
}

/**
 * Like str() but also handles objects with name/value/primary keys
 * (e.g. make: { name: "Toyota" } or colour: { primary: "White" }).
 */
function strObj(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (c === undefined || c === null || c === '') continue
    if (Array.isArray(c)) {
      if (c.length > 0 && c[0] !== null && c[0] !== undefined && c[0] !== '') {
        const item = c[0]
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>
          const val = obj.name ?? obj.value ?? obj.number ?? obj.primary ?? Object.values(obj)[0]
          if (val !== undefined && val !== null && val !== '') return String(val)
        } else {
          return String(item)
        }
      }
      continue
    }
    if (typeof c === 'object') {
      const obj = c as Record<string, unknown>
      const val = obj.name ?? obj.value ?? obj.number ?? obj.primary ?? obj.description ?? undefined
      if (val !== undefined && val !== null && val !== '') return String(val)
      // Don't return "[object Object]" — skip
      continue
    }
    return String(c)
  }
  return ''
}

function num(...candidates: unknown[]): number {
  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      if (Array.isArray(c)) {
        if (c.length > 0) {
          const n = Number(c[0])
          if (!isNaN(n) && n > 0) return n
        }
        continue
      }
      if (typeof c === 'object') {
        const obj = c as Record<string, unknown>
        const val = obj.value ?? obj.amount ?? obj.price ?? Object.values(obj)[0]
        if (val !== undefined && val !== null) {
          const n = Number(val)
          if (!isNaN(n) && n > 0) return n
        }
        continue
      }
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
