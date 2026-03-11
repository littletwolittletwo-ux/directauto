import { NextResponse } from 'next/server'

/**
 * TEMPORARY DEBUG ROUTE — remove after diagnosing PPSR auth issue.
 * GET /api/debug/ppsr-test
 *
 * Makes the raw PPSR Cloud OAuth2 token + search call and returns full responses.
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

  // ── Step 1: Get OAuth2 token ──
  const tokenUrl = `${baseUrl}/oauth/token`

  const tokenBody = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const tokenBodyString = tokenBody.toString()

  console.log('[PPSR-DEBUG] ── Token Request ──')
  console.log('[PPSR-DEBUG] URL:', tokenUrl)
  console.log('[PPSR-DEBUG] Content-Type: application/x-www-form-urlencoded')
  console.log('[PPSR-DEBUG] Body:', tokenBodyString.replace(/client_secret=[^&]+/, 'client_secret=***'))
  console.log('[PPSR-DEBUG] client_id:', clientId)
  console.log('[PPSR-DEBUG] client_secret length:', clientSecret.length)

  let tokenResponse: Response
  try {
    tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBodyString,
    })
  } catch (err) {
    return NextResponse.json({
      error: 'Token request network error',
      message: err instanceof Error ? err.message : String(err),
      tokenUrl,
    }, { status: 500 })
  }

  const tokenText = await tokenResponse.text()
  const tokenHeaders: Record<string, string> = {}
  tokenResponse.headers.forEach((value, key) => { tokenHeaders[key] = value })

  console.log('[PPSR-DEBUG] ── Token Response ──')
  console.log('[PPSR-DEBUG] Status:', tokenResponse.status, tokenResponse.statusText)
  console.log('[PPSR-DEBUG] Headers:', JSON.stringify(tokenHeaders))
  console.log('[PPSR-DEBUG] Body:', tokenText.slice(0, 500))

  let tokenParsed: unknown = tokenText
  try {
    tokenParsed = JSON.parse(tokenText)
  } catch {
    // keep as string
  }

  if (!tokenResponse.ok) {
    return NextResponse.json({
      error: 'OAuth2 token request failed',
      tokenRequest: {
        url: tokenUrl,
        contentType: 'application/x-www-form-urlencoded',
        clientId,
        clientSecretLength: clientSecret.length,
      },
      tokenResponse: {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        headers: tokenHeaders,
        body: tokenParsed,
      },
    }, { status: 200 }) // return 200 so we can always see the debug output
  }

  const tokenData = tokenParsed as Record<string, unknown>
  const accessToken = tokenData?.access_token as string | undefined

  if (!accessToken) {
    return NextResponse.json({
      error: 'Token response missing access_token',
      tokenResponse: {
        status: tokenResponse.status,
        body: tokenParsed,
      },
    }, { status: 200 })
  }

  // ── Step 2: Search by VIN ──
  const searchUrl = `${baseUrl}/api/b2b/Middleware/afsa-submit-mv-search`
  const searchBody = { vin: 'KMHH351EMKU00TEST' }

  console.log('[PPSR-DEBUG] ── Search Request ──')
  console.log('[PPSR-DEBUG] URL:', searchUrl)
  console.log('[PPSR-DEBUG] Authorization: Bearer', accessToken.slice(0, 10) + '...')
  console.log('[PPSR-DEBUG] Body:', JSON.stringify(searchBody))

  const searchStart = Date.now()

  let searchResponse: Response
  try {
    searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(searchBody),
    })
  } catch (err) {
    return NextResponse.json({
      error: 'Search request network error',
      message: err instanceof Error ? err.message : String(err),
      searchUrl,
      tokenObtained: true,
    }, { status: 200 })
  }

  const searchElapsed = Date.now() - searchStart
  const searchText = await searchResponse.text()
  const searchHeaders: Record<string, string> = {}
  searchResponse.headers.forEach((value, key) => { searchHeaders[key] = value })

  console.log('[PPSR-DEBUG] ── Search Response ──')
  console.log('[PPSR-DEBUG] Status:', searchResponse.status, searchResponse.statusText)
  console.log('[PPSR-DEBUG] Elapsed:', searchElapsed, 'ms')
  console.log('[PPSR-DEBUG] Headers:', JSON.stringify(searchHeaders))
  console.log('[PPSR-DEBUG] Body:', searchText.slice(0, 1000))

  let searchParsed: unknown = searchText
  try {
    searchParsed = JSON.parse(searchText)
  } catch {
    // keep as string
  }

  return NextResponse.json({
    debug: 'PPSR Cloud OAuth2 full debug output',
    step1_token: {
      request: {
        url: tokenUrl,
        method: 'POST',
        contentType: 'application/x-www-form-urlencoded',
        clientId,
        clientSecretLength: clientSecret.length,
      },
      response: {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        headers: tokenHeaders,
        tokenLength: accessToken.length,
        tokenPreview: accessToken.slice(0, 20) + '...',
      },
    },
    step2_search: {
      request: {
        url: searchUrl,
        method: 'POST',
        body: searchBody,
      },
      response: {
        status: searchResponse.status,
        statusText: searchResponse.statusText,
        headers: searchHeaders,
        body: searchParsed,
        elapsedMs: searchElapsed,
      },
    },
  }, { status: 200 })
}
