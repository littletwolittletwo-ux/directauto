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
      features: [],
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

  // Merge nested specification/details objects — Autograb may return make/model/year
  // inside a nested object while VIN/rego/colour are at the top level
  let m = { ...d }
  for (const key of ['specification', 'specifications', 'details', 'vehicle_details', 'attributes', 'vehicle_specification', 'vehicle']) {
    const nested = d[key]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      console.log('[AUTOGRAB] Merging nested "' + key + '" with keys:', Object.keys(nested as object))
      // Spread nested first so top-level values win when both exist
      m = { ...(nested as Record<string, unknown>), ...m }
    }
  }

  // Second pass: scan ALL nested objects for fields we still don't have.
  // Catches VIN inside "identifiers", colour inside "appearance", rego inside
  // "registration", odometer inside "condition", etc.
  for (const [key, val] of Object.entries(d)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const nested = val as Record<string, unknown>
      let mergedAny = false
      for (const [nk, nv] of Object.entries(nested)) {
        if (nv !== undefined && nv !== null && nv !== '' &&
            (m[nk] === undefined || m[nk] === null || m[nk] === '' || m[nk] === 0)) {
          m[nk] = nv
          mergedAny = true
        }
      }
      if (mergedAny) {
        console.log('[AUTOGRAB] Also merged missing fields from "' + key + '":', Object.keys(nested))
      }
    }
  }

  console.log('[AUTOGRAB] Merged keys:', Object.keys(m))
  console.log('[AUTOGRAB] Make/Model/Year candidates:', JSON.stringify({
    make: m.make, brand: m.brand, manufacturer: m.manufacturer,
    model: m.model, family: m.family, series: m.series, model_family: m.model_family,
    year: m.year, year_of_manufacture: m.year_of_manufacture, build_year: m.build_year, year_group: m.year_group,
  }))
  console.log('[AUTOGRAB] Engine/Trans/Body candidates:', JSON.stringify({
    engine: m.engine, engine_description: m.engine_description, engine_type: m.engine_type,
    transmission: m.transmission, gearbox: m.gearbox, gear_type: m.gear_type, transmission_type: m.transmission_type,
    body_type: m.body_type, body_style: m.body_style, body_configuration: m.body_configuration, body: m.body,
  }))
  console.log('[AUTOGRAB] VIN candidates:', JSON.stringify({ vin: m.vin, vins: m.vins, VIN: m.VIN, chassis_number: m.chassis_number }))
  console.log('[AUTOGRAB] Colour candidates:', JSON.stringify({ colour: m.colour, color: m.color, exterior_colour: m.exterior_colour, primary_colour: m.primary_colour, paint: m.paint, paint_colour: m.paint_colour, ext_colour: m.ext_colour, vehicle_colour: m.vehicle_colour }))
  console.log('[AUTOGRAB] Rego candidates:', JSON.stringify({ registration_number: m.registration_number, plate: m.plate, rego: m.rego, registration: m.registration, registration_no: m.registration_no, reg_no: m.reg_no, licence_plate: m.licence_plate, number_plate: m.number_plate }))

  const result = {
    vehicle_id: str(m.vehicle_id, m.vehicleId, m.id, m.autograb_id, m.autograbId),
    make: strObj(m.make, m.Make, m.manufacturer, m.Manufacturer, m.brand, m.Brand, m.make_description),
    model: strObj(m.model, m.Model, m.family, m.Family, m.variant, m.Variant, m.series, m.Series, m.model_family, m.model_description),
    year: num(m.year, m.Year, m.year_of_manufacture, m.yearOfManufacture, m.build_year, m.buildYear, m.manufacture_year, m.year_group, m.yearGroup, m.production_year),
    vin: strArr(m.vin, m.vins, m.Vin, m.VIN, m.chassis_number, m.chassisNumber, m.chassis, m.Chassis, m.vin_number, m.vinNumber),
    registration_number: strObj(m.registration_number, m.registrationNumber, m.plate, m.Plate, m.rego, m.Rego, m.registration, m.Registration, m.plate_number, m.plateNumber, m.plates, m.number_plate, m.numberPlate, m.registration_no, m.reg_no, m.regNo, m.licence_plate, m.license_plate, m.reg_number, m.regNumber),
    colour: strObj(m.colour, m.color, m.Colour, m.Color, m.exterior_colour, m.exteriorColour, m.exterior_color, m.exteriorColor, m.primary_colour, m.primaryColour, m.primary_color, m.paint, m.paint_colour, m.paintColour, m.ext_colour, m.extColour, m.vehicle_colour, m.vehicleColour),
    engine: strObj(m.engine, m.Engine, m.engine_description, m.engineDescription, m.engine_type, m.engineType, m.engine_size, m.fuel_type, m.fuelType),
    transmission: strObj(m.transmission, m.Transmission, m.transmission_type, m.transmissionType, m.gearbox, m.Gearbox, m.gear_type, m.gearType, m.drive_type),
    body_type: strObj(m.body_type, m.bodyType, m.body_style, m.bodyStyle, m.BodyType, m.body, m.Body, m.body_configuration, m.bodyConfiguration),
    odometer: num(m.odometer, m.Odometer, m.kms, m.km, m.mileage, m.Mileage, m.kilometres),
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
  const url = `${base}/v2/car-analyses`

  const body: Record<string, unknown> = {
    sources: ['ppsr'],
    region: 'au',
  }
  if (params.vin) body.vin = params.vin
  if (params.rego) body.rego = params.rego
  if (params.state) body.state = params.state
  if (params.odometer) body.odometer = params.odometer

  console.log('[AUTOGRAB] Creating car analysis — URL:', url)
  console.log('[AUTOGRAB] Creating car analysis — body:', JSON.stringify(body))

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
  const url = `${base}/v2/car-analyses/${encodeURIComponent(reportId)}`

  console.log('[AUTOGRAB] Fetching car analysis result — URL:', url)

  const response = await fetch(url, {
    headers: { ApiKey: apiKey },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Autograb car analysis fetch failed: ${response.status} - ${text}`)
  }

  const data = await response.json()
  // Log full response (up to 3000 chars to capture certificate/PDF fields)
  console.log('[AUTOGRAB] Car analysis FULL result:', JSON.stringify(data).slice(0, 3000))
  console.log('[AUTOGRAB] Car analysis top-level keys:', Object.keys(data))

  // Log any certificate/report/PDF related fields
  const certKeys = ['certificate', 'report', 'pdf', 'pdf_url', 'url', 'document', 'document_url', 'report_url', 'certificate_url', 'ppsr', 'ppsr_certificate', 'ppsr_report']
  const foundCertFields: Record<string, unknown> = {}
  for (const key of certKeys) {
    if (data[key] !== undefined) foundCertFields[key] = data[key]
  }
  console.log('[AUTOGRAB] Certificate/PDF fields found:', JSON.stringify(foundCertFields))

  // Extract PPSR flags — try multiple locations in the response
  const cert = (data.certificate ?? data.ppsr ?? data.ppsr_certificate ?? data.report ?? data) as Record<string, unknown>
  console.log('[AUTOGRAB] PPSR cert section keys:', Object.keys(cert))

  // Also check nested data.data or data.results
  const nested = (data.data && typeof data.data === 'object' ? data.data : cert) as Record<string, unknown>

  const isStolen = Boolean(
    cert.has_stolen_records ?? cert.stolen ?? cert.is_stolen ??
    nested.has_stolen_records ?? nested.stolen ?? nested.is_stolen ?? false
  )
  const isWrittenOff = Boolean(
    cert.has_written_off_records ?? cert.written_off ?? cert.is_written_off ??
    nested.has_written_off_records ?? nested.written_off ?? nested.is_written_off ?? false
  )
  const hasFinance = Boolean(
    cert.has_secured_parties ?? cert.has_finance ?? cert.finance ?? cert.encumbered ??
    nested.has_secured_parties ?? nested.has_finance ?? nested.finance ?? nested.encumbered ?? false
  )

  // Extract PDF/certificate URL from multiple possible locations
  const pdfUrl = str(
    data.pdf_url, data.url, data.document_url, data.report_url, data.certificate_url,
    cert.pdf_url, cert.url, cert.document_url, cert.report_url,
    nested.pdf_url, nested.url, nested.document_url, nested.report_url,
  ) || undefined

  console.log('[AUTOGRAB] Extracted — stolen:', isStolen, 'writtenOff:', isWrittenOff, 'finance:', hasFinance, 'pdfUrl:', pdfUrl)

  return {
    id: reportId,
    status: String(data.status ?? 'completed'),
    isWrittenOff,
    isStolen,
    hasFinance,
    encumbered: hasFinance,
    pdfUrl,
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
