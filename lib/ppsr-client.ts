/**
 * PPSR Cloud B2B API client
 * Auth: OAuth2 Client Credentials (application/x-www-form-urlencoded)
 * Search endpoint: POST /api/b2b/Middleware/afsa-submit-mv-search (synchronous motor vehicle search)
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
  const clientId = process.env.PPSR_CLIENT_ID
  const clientSecret = process.env.PPSR_CLIENT_SECRET

  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error(
      'PPSR Cloud credentials not configured. Set PPSR_CLOUD_BASE_URL, PPSR_CLIENT_ID, and PPSR_CLIENT_SECRET environment variables.'
    )
  }

  return { baseUrl, clientId, clientSecret }
}

/**
 * Try multiple possible token endpoint paths.
 * PPSR Cloud uses OAuth2 client credentials with form-urlencoded body.
 */
async function getAccessToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const tokenPaths = [
    '/connect/token',
    '/identity/connect/token',
    '/oauth/token',
    '/api/oauth/token',
  ]

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  let lastError = ''

  for (const path of tokenPaths) {
    const tokenUrl = `${baseUrl}${path}`
    console.log(`[PPSR] Trying token endpoint: ${tokenUrl}`)

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })

      const responseText = await response.text()
      console.log(`[PPSR] Token endpoint ${path} → ${response.status} ${response.statusText}`)

      if (!response.ok) {
        lastError = `${tokenUrl}: ${response.status} ${response.statusText} - ${responseText.slice(0, 300)}`
        console.log(`[PPSR] Token endpoint failed: ${lastError}`)
        continue
      }

      let data: { access_token: string }
      try {
        data = JSON.parse(responseText)
      } catch {
        lastError = `${tokenUrl}: Invalid JSON response - ${responseText.slice(0, 300)}`
        console.log(`[PPSR] Token endpoint returned invalid JSON: ${responseText.slice(0, 300)}`)
        continue
      }

      if (!data.access_token) {
        lastError = `${tokenUrl}: Response missing access_token - ${responseText.slice(0, 300)}`
        console.log(`[PPSR] Token response missing access_token`)
        continue
      }

      console.log(`[PPSR] Successfully obtained token from ${path}`)
      return data.access_token
    } catch (err) {
      lastError = `${tokenUrl}: Network error - ${err instanceof Error ? err.message : String(err)}`
      console.log(`[PPSR] Network error for ${path}:`, err)
      continue
    }
  }

  throw new Error(
    `PPSR OAuth2 token error: All token endpoints failed. Last error: ${lastError}`
  )
}

export async function searchByVIN(vin: string): Promise<PPSRSearchResult> {
  const { baseUrl, clientId, clientSecret } = getConfig()

  const accessToken = await getAccessToken(baseUrl, clientId, clientSecret)

  const url = `${baseUrl}/api/b2b/Middleware/afsa-submit-mv-search`
  const requestBody = { vin }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  }

  console.log('[PPSR] POST', url)

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  })

  const responseText = await response.text()
  console.log('[PPSR] Status:', response.status, response.statusText)

  if (!response.ok) {
    console.log('[PPSR] Error response body:', responseText.slice(0, 500))
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
