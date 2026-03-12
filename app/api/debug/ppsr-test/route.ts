import { NextResponse } from 'next/server'

/**
 * TEMPORARY DEBUG ROUTE — remove after diagnosing PPSR auth issue.
 * GET /api/debug/ppsr-test
 *
 * Tries multiple token endpoint paths, then calls the search API.
 */
export async function GET() {
  const baseUrl = process.env.PPSR_CLOUD_BASE_URL
  const clientId = process.env.PPSR_CLIENT_ID
  const clientSecret = process.env.PPSR_CLIENT_SECRET

  if (!baseUrl || !clientId || !clientSecret) {
    return NextResponse.json({
      error: 'Missing env vars',
      PPSR_CLOUD_BASE_URL: baseUrl ?? null,
      PPSR_CLIENT_ID_SET: !!clientId,
      PPSR_CLIENT_SECRET_SET: !!clientSecret,
    }, { status: 500 })
  }

  const tokenBody = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })
  const tokenBodyString = tokenBody.toString()

  // ── Try multiple token endpoints ──
  const TOKEN_PATHS = [
    '/connect/token',   // IdentityServer4 / Duende (most common for .NET)
    '/oauth/token',     // Generic OAuth2
    '/oauth2/token',    // Alternative
    '/api/token',       // Some gateways
  ]

  const tokenAttempts: Array<{
    url: string
    status: number
    statusText: string
    body: unknown
  }> = []

  let accessToken: string | null = null
  let successfulTokenUrl: string | null = null

  for (const path of TOKEN_PATHS) {
    const tokenUrl = `${baseUrl}${path}`
    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBodyString,
      })

      const text = await response.text()
      let parsed: unknown = text
      try { parsed = JSON.parse(text) } catch { /* keep as string */ }

      tokenAttempts.push({
        url: tokenUrl,
        status: response.status,
        statusText: response.statusText,
        body: parsed,
      })

      if (response.ok) {
        const data = parsed as Record<string, unknown>
        if (data?.access_token) {
          accessToken = data.access_token as string
          successfulTokenUrl = tokenUrl
          break // Found a working endpoint
        }
      }
    } catch (err) {
      tokenAttempts.push({
        url: tokenUrl,
        status: 0,
        statusText: 'NETWORK_ERROR',
        body: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (!accessToken) {
    return NextResponse.json({
      error: 'All token endpoints failed',
      baseUrl,
      clientId,
      clientSecretLength: clientSecret.length,
      tokenAttempts,
    }, { status: 200 })
  }

  // ── Search by VIN ──
  const searchUrl = `${baseUrl}/api/b2b/Middleware/afsa-submit-mv-search`
  const searchBody = { vin: 'KMHH351EMKU00TEST' }

  let searchResult: {
    url: string
    status: number
    statusText: string
    body: unknown
    elapsedMs: number
  }

  const searchStart = Date.now()
  try {
    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(searchBody),
    })

    const searchElapsed = Date.now() - searchStart
    const searchText = await searchResponse.text()
    let searchParsed: unknown = searchText
    try { searchParsed = JSON.parse(searchText) } catch { /* keep as string */ }

    searchResult = {
      url: searchUrl,
      status: searchResponse.status,
      statusText: searchResponse.statusText,
      body: searchParsed,
      elapsedMs: searchElapsed,
    }
  } catch (err) {
    searchResult = {
      url: searchUrl,
      status: 0,
      statusText: 'NETWORK_ERROR',
      body: err instanceof Error ? err.message : String(err),
      elapsedMs: Date.now() - searchStart,
    }
  }

  return NextResponse.json({
    debug: 'PPSR Cloud full debug — token + search',
    step1_token: {
      successfulUrl: successfulTokenUrl,
      tokenLength: accessToken.length,
      tokenPreview: accessToken.slice(0, 20) + '...',
      allAttempts: tokenAttempts,
    },
    step2_search: {
      request: { url: searchUrl, method: 'POST', body: searchBody },
      response: searchResult,
    },
  }, { status: 200 })
}
