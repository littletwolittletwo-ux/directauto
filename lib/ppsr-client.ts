/**
 * PPSR Cloud B2B API client
 * Auth: OAuth2 Client Credentials (application/x-www-form-urlencoded)
 * Token endpoint: POST {baseUrl}/connect/token (IdentityServer) or /oauth/token
 * Search endpoint: POST {baseUrl}/api/b2b/Middleware/afsa-submit-mv-search
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
 * Get OAuth2 access token from PPSR Cloud.
 * Uses client_credentials grant with form-urlencoded body.
 * Tries /connect/token (IdentityServer) then /oauth/token as fallback.
 */
async function getAccessToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const TOKEN_PATHS = ['/connect/token', '/oauth/token']

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })
  const bodyString = body.toString()

  for (const path of TOKEN_PATHS) {
    const tokenUrl = `${baseUrl}${path}`

    console.log('[PPSR] ── Token Request ──')
    console.log('[PPSR] URL:', tokenUrl)
    console.log('[PPSR] Content-Type: application/x-www-form-urlencoded')

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyString,
      })

      const responseText = await response.text()

      console.log('[PPSR] ── Token Response ──')
      console.log('[PPSR] Status:', response.status, response.statusText)
      console.log('[PPSR] Body:', responseText.slice(0, 500))

      if (!response.ok) {
        console.log(`[PPSR] ${path} failed with ${response.status}, trying next...`)
        continue
      }

      let data: { access_token: string }
      try {
        data = JSON.parse(responseText)
      } catch {
        console.log(`[PPSR] ${path} returned invalid JSON, trying next...`)
        continue
      }

      if (!data.access_token) {
        console.log(`[PPSR] ${path} response missing access_token, trying next...`)
        continue
      }

      console.log('[PPSR] Token obtained from', path, '(length:', data.access_token.length, ')')
      return data.access_token
    } catch (err) {
      console.error(`[PPSR] ${path} network error:`, err instanceof Error ? err.message : String(err))
      continue
    }
  }

  throw new Error(
    `PPSR OAuth2 token failed on all endpoints: ${TOKEN_PATHS.map(p => baseUrl + p).join(', ')}`
  )
}

export async function searchByVIN(vin: string): Promise<PPSRSearchResult> {
  const { baseUrl, clientId, clientSecret } = getConfig()

  const accessToken = await getAccessToken(baseUrl, clientId, clientSecret)

  const url = `${baseUrl}/api/b2b/Middleware/afsa-submit-mv-search`
  const requestBody = { vin }

  console.log('[PPSR] ── Search Request ──')
  console.log('[PPSR] URL:', url)
  console.log('[PPSR] Method: POST')
  console.log('[PPSR] Authorization: Bearer', accessToken.slice(0, 10) + '...')
  console.log('[PPSR] Body:', JSON.stringify(requestBody))

  const startTime = Date.now()

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(requestBody),
  })

  const elapsed = Date.now() - startTime
  const responseText = await response.text()

  console.log('[PPSR] ── Search Response ──')
  console.log('[PPSR] Status:', response.status, response.statusText)
  console.log('[PPSR] Elapsed:', elapsed, 'ms')
  const responseHeaders: Record<string, string> = {}
  response.headers.forEach((value, key) => { responseHeaders[key] = value })
  console.log('[PPSR] Headers:', JSON.stringify(responseHeaders))
  console.log('[PPSR] Body:', responseText.slice(0, 1000))

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
