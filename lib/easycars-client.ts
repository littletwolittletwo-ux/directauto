/**
 * EasyCars integration client
 * API-first with CSV fallback when API key is placeholder
 */

const EASYCARS_API_ENABLED =
  process.env.EASYCARS_API_KEY &&
  process.env.EASYCARS_API_KEY !== 'EASYCARS_API_KEY_PLACEHOLDER' &&
  process.env.EASYCARS_API_KEY !== 'PLACEHOLDER'

export interface EasyCarsVehicleData {
  vin: string
  registrationNumber: string
  make: string
  model: string
  year: number
  odometer: number
  colour?: string
  bodyType?: string
  transmission?: string
  engine?: string
  purchasePrice: number
  sellerName: string
  sellerPhone: string
  sellerEmail: string
}

export function isApiEnabled(): boolean {
  return !!EASYCARS_API_ENABLED
}

export async function syncVehicle(data: EasyCarsVehicleData): Promise<{ success: boolean; method: 'api' | 'csv' }> {
  if (EASYCARS_API_ENABLED) {
    return syncViaApi(data)
  }
  return { success: true, method: 'csv' }
}

async function syncViaApi(data: EasyCarsVehicleData): Promise<{ success: boolean; method: 'api' | 'csv' }> {
  const apiKey = process.env.EASYCARS_API_KEY!
  const apiUrl = process.env.EASYCARS_API_URL || 'https://api.easycars.com.au/vehicles'

  console.log('[EASYCARS] Syncing vehicle via API:', data.vin)

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vin: data.vin,
      registration_number: data.registrationNumber,
      make: data.make,
      model: data.model,
      year: data.year,
      odometer: data.odometer,
      colour: data.colour,
      body_type: data.bodyType,
      transmission: data.transmission,
      engine: data.engine,
      purchase_price: data.purchasePrice,
      seller_name: data.sellerName,
      seller_phone: data.sellerPhone,
      seller_email: data.sellerEmail,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`EasyCars API error: ${response.status} - ${text}`)
  }

  console.log('[EASYCARS] Vehicle synced successfully via API')
  return { success: true, method: 'api' }
}

export function generateCSV(data: EasyCarsVehicleData): string {
  const headers = [
    'VIN',
    'Registration',
    'Make',
    'Model',
    'Year',
    'Odometer',
    'Colour',
    'Body Type',
    'Transmission',
    'Engine',
    'Purchase Price',
    'Seller Name',
    'Seller Phone',
    'Seller Email',
  ]

  const values = [
    data.vin,
    data.registrationNumber,
    data.make,
    data.model,
    String(data.year),
    String(data.odometer),
    data.colour || '',
    data.bodyType || '',
    data.transmission || '',
    data.engine || '',
    String(data.purchasePrice),
    data.sellerName,
    data.sellerPhone,
    data.sellerEmail,
  ].map((v) => `"${v.replace(/"/g, '""')}"`)

  return headers.join(',') + '\n' + values.join(',')
}
