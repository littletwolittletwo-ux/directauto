import { NextResponse } from 'next/server'

/**
 * TEMPORARY DEBUG ROUTE — remove after diagnosing PPSR auth issue.
 * GET /api/debug/ppsr-test
 *
 * Makes the raw PPSR Cloud API call using OAuth2 and returns the full response.
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

  // Step 1: Get OAuth2 token
  const tokenUrl = `${baseUrl}/oauth/token`
  console.log('[PPSR-DEBUG] Requesting OAuth2 token from', tokenUrl)

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  const tokenText = await tokenResponse.text()
  console.log('[PPSR-DEBUG] Token response status:', tokenResponse.status)

  if (!tokenResponse.ok) {
    return NextResponse.json({
      error: 'OAuth2 token request failed',
      status: tokenResponse.status,
      body: tokenText,
    }, { status: 500 })
  }

  let tokenData: { access_token: string }
  try {
    tokenData = JSON.parse(tokenText)
  } catch {
    return NextResponse.json({
      error: 'OAuth2 token response is not valid JSON',
      body: tokenText.slice(0, 500),
    }, { status: 500 })
  }

  // Step 2: Search by VIN
  const searchUrl = `${baseUrl}/api/b2b/Middleware/afsa-submit-mv-search`
  const requestBody = { vin: 'KMHH351EMKU00TEST' }

  console.log('[PPSR-DEBUG] Searching VIN at', searchUrl)
  const startTime = Date.now()

  const response = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenData.access_token}`,
    },
    body: JSON.stringify(requestBody),
  })

  const elapsed = Date.now() - startTime
  const responseText = await response.text()

  const responseHeaders: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value
  })

  let parsedBody: unknown = responseText
  try {
    parsedBody = JSON.parse(responseText)
  } catch {
    // body is not JSON, keep as string
  }

  return NextResponse.json({
    debug: 'PPSR Cloud OAuth2 API response',
    request: {
      method: 'POST',
      url: searchUrl,
      body: requestBody,
    },
    response: {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: parsedBody,
      elapsedMs: elapsed,
    },
  }, { status: 200 })
}
