import { NextResponse } from 'next/server'

/**
 * TEMPORARY DEBUG ROUTE — remove after diagnosing PPSR auth issue.
 * GET /api/debug/ppsr-test
 *
 * Makes the raw PPSR Cloud API call and returns the full response
 * (status, headers, body) without catching errors.
 */
export async function GET() {
  const baseUrl = process.env.PPSR_CLOUD_BASE_URL
  const username = process.env.PPSR_CLOUD_USERNAME
  const password = process.env.PPSR_CLOUD_PASSWORD

  console.log('[PPSR-DEBUG] Step 1: Reading env vars')
  console.log('[PPSR-DEBUG]   PPSR_CLOUD_BASE_URL =', baseUrl)
  console.log('[PPSR-DEBUG]   PPSR_CLOUD_USERNAME =', username)
  console.log('[PPSR-DEBUG]   PPSR_CLOUD_PASSWORD length =', password?.length ?? 'undefined')
  console.log('[PPSR-DEBUG]   PPSR_CLOUD_PASSWORD raw repr =', JSON.stringify(password))
  console.log('[PPSR-DEBUG]   Base64 credential =', Buffer.from(`${username}:${password}`).toString('base64'))
  console.log('[PPSR-DEBUG]   Decoded credential =', Buffer.from(Buffer.from(`${username}:${password}`).toString('base64'), 'base64').toString())

  if (!baseUrl || !username || !password) {
    return NextResponse.json({
      error: 'Missing env vars',
      PPSR_CLOUD_BASE_URL: baseUrl ?? null,
      PPSR_CLOUD_USERNAME: username ?? null,
      PPSR_CLOUD_PASSWORD_SET: !!password,
    }, { status: 500 })
  }

  const url = `${baseUrl}/api/b2b/Middleware/afsa-submit-mv-search`
  const encoded = Buffer.from(`${username}:${password}`).toString('base64')
  const authHeader = `Basic ${encoded}`

  const requestBody = {
    vin: 'KMHH351EMKU00TEST',
  }

  console.log('[PPSR-DEBUG] Step 2: Building request')
  console.log('[PPSR-DEBUG]   URL:', url)
  console.log('[PPSR-DEBUG]   Method: POST')
  console.log('[PPSR-DEBUG]   Auth header (first 20 chars):', authHeader.slice(0, 20) + '...')
  console.log('[PPSR-DEBUG]   Base64 credential:', encoded)
  console.log('[PPSR-DEBUG]   Request body:', JSON.stringify(requestBody))

  console.log('[PPSR-DEBUG] Step 3: Sending fetch...')
  const startTime = Date.now()

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify(requestBody),
  })

  const elapsed = Date.now() - startTime
  console.log('[PPSR-DEBUG] Step 4: Response received in', elapsed, 'ms')

  const responseText = await response.text()

  // Collect all response headers
  const responseHeaders: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value
  })

  console.log('[PPSR-DEBUG] Step 5: Response details')
  console.log('[PPSR-DEBUG]   Status:', response.status, response.statusText)
  console.log('[PPSR-DEBUG]   Headers:', JSON.stringify(responseHeaders, null, 2))
  console.log('[PPSR-DEBUG]   Body:', responseText)

  // Try to parse body as JSON for cleaner output
  let parsedBody: unknown = responseText
  try {
    parsedBody = JSON.parse(responseText)
  } catch {
    // body is not JSON, keep as string
  }

  return NextResponse.json({
    debug: 'PPSR Cloud raw API response',
    request: {
      method: 'POST',
      url,
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      'Authorization-Decoded': Buffer.from(encoded, 'base64').toString(),
      },
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
