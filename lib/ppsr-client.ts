/**
 * PPSR Cloud B2B API client
 * Auth: HTTP Basic Auth (username:password base64-encoded)
 * Endpoint: POST /api/b2b/Middleware/afsa-submit-mv-search (synchronous motor vehicle search)
 * Request: MiddlewareAuSubmitMvSearchApiRequest
 * Response: AuMvSearchResultApiResponseApiResponseCommon
 */

export interface PPSRSearchResult {
  isWrittenOff: boolean
  isStolen: boolean
  hasFinance: boolean
  encumbered: boolean
  rawResult: Record<string, unknown>
}

interface AuMvSearchResultApiResponse {
  nevdisVerificationStatus: string | null
  nevdisWrittenOff: boolean | null
  nevdisStolen: boolean | null
  searchCertificateNumber: string | null
  searchCertificateFileGuid: string | null
  nevdisVehicles: unknown[] | null
  registrations: unknown[] | null
  searchNumber: string | null
  criteriaSummary: string | null
  resultCount: number
  securityInterestExists: boolean
  hasSecurityInterestChangedSinceLastSearch: string | null
  ppsrCloudId: string
}

interface ApiResponseError {
  code: number
  errorDescription: string
}

interface AuMvSearchResultApiResponseCommon {
  resource: AuMvSearchResultApiResponse | null
  errors: ApiResponseError[] | null
  hasError: boolean
}

function getConfig() {
  const baseUrl = process.env.PPSR_CLOUD_BASE_URL
  const username = process.env.PPSR_CLOUD_USERNAME
  const password = process.env.PPSR_CLOUD_PASSWORD

  if (!baseUrl || !username || !password) {
    throw new Error(
      'PPSR Cloud credentials not configured. Set PPSR_CLOUD_BASE_URL, PPSR_CLOUD_USERNAME, and PPSR_CLOUD_PASSWORD in .env'
    )
  }

  return { baseUrl, username, password }
}

function getBasicAuthHeader(username: string, password: string): string {
  const credentials = Buffer.from(`${username}:${password}`).toString('base64')
  return `Basic ${credentials}`
}

export async function searchByVIN(vin: string): Promise<PPSRSearchResult> {
  const { baseUrl, username, password } = getConfig()
  const url = `${baseUrl}/api/b2b/Middleware/afsa-submit-mv-search`

  const requestBody = { vin }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: getBasicAuthHeader(username, password),
  }

  console.log('[PPSR] ===== RAW REQUEST =====')
  console.log('[PPSR] POST', url)
  console.log('[PPSR] Headers:', JSON.stringify(headers, null, 2))
  console.log('[PPSR] Body:', JSON.stringify(requestBody, null, 2))
  console.log('[PPSR] ========================')

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  })

  const responseText = await response.text()
  console.log('[PPSR] ===== RAW RESPONSE =====')
  console.log('[PPSR] Status:', response.status, response.statusText)
  console.log('[PPSR] Response Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2))
  console.log('[PPSR] Response Body:', responseText)
  console.log('[PPSR] ===========================')

  if (!response.ok) {
    throw new Error(
      `PPSR Cloud API error: ${response.status} ${response.statusText} - ${responseText}`
    )
  }

  let data: AuMvSearchResultApiResponseCommon
  try {
    data = JSON.parse(responseText)
  } catch {
    throw new Error(`PPSR Cloud returned invalid JSON: ${responseText.slice(0, 500)}`)
  }

  if (data.hasError || !data.resource) {
    const errorMsg =
      data.errors?.map((e) => `[${e.code}] ${e.errorDescription}`).join('; ') ||
      'Unknown PPSR API error'
    throw new Error(`PPSR search failed: ${errorMsg}`)
  }

  const result = data.resource
  const isWrittenOff = result.nevdisWrittenOff === true
  const isStolen = result.nevdisStolen === true
  const hasFinance = result.securityInterestExists === true
  const encumbered = hasFinance || result.resultCount > 0

  return {
    isWrittenOff,
    isStolen,
    hasFinance,
    encumbered,
    rawResult: data.resource as unknown as Record<string, unknown>,
  }
}
