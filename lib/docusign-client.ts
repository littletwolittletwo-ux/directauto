/**
 * DocuSign eSignature REST API client
 * Auth: JWT Grant (server-to-server)
 * Configured for Australian production (au.docusign.net)
 */

interface DocuSignConfig {
  integrationKey: string
  accountId: string
  userId: string
  privateKey: string
  basePath: string
  authServer: string
}

function getConfig(): DocuSignConfig {
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID
  const userId = process.env.DOCUSIGN_USER_ID
  const privateKey = process.env.DOCUSIGN_PRIVATE_KEY
  const basePath = process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi'
  const authServer = process.env.DOCUSIGN_AUTH_SERVER || 'account-d.docusign.com'

  if (!integrationKey || !accountId || !userId || !privateKey) {
    throw new Error(
      'DocuSign credentials not configured. Set DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_USER_ID, and DOCUSIGN_PRIVATE_KEY.'
    )
  }

  return { integrationKey, accountId, userId, privateKey, basePath, authServer }
}

let cachedToken: { token: string; expiresAt: number } | null = null

function formatPrivateKey(raw: string): string {
  // Handle multiple possible formats from env vars:
  // 1. Literal \n in string (e.g. from .env with "...\n...")
  // 2. Actual newlines (e.g. from Vercel env vars)
  // 3. Wrapped in extra quotes
  let key = raw.trim()

  // Strip surrounding quotes if present
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1)
  }

  // Replace literal \n with actual newlines
  key = key.replace(/\\n/g, '\n')

  // If there are no newlines at all, try to reconstruct PEM format
  if (!key.includes('\n')) {
    // Strip header/footer if present inline
    const body = key
      .replace('-----BEGIN RSA PRIVATE KEY-----', '')
      .replace('-----END RSA PRIVATE KEY-----', '')
      .replace(/\s+/g, '')

    // Rebuild with 64-char lines
    const lines = body.match(/.{1,64}/g) || []
    key = ['-----BEGIN RSA PRIVATE KEY-----', ...lines, '-----END RSA PRIVATE KEY-----'].join('\n')
  }

  return key
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  const config = getConfig()

  // JWT Grant flow
  const now = Math.floor(Date.now() / 1000)
  const jwtPayload = {
    iss: config.integrationKey,
    sub: config.userId,
    aud: config.authServer,
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  }

  console.log('[DOCUSIGN] JWT payload:', JSON.stringify({
    iss: jwtPayload.iss,
    sub: jwtPayload.sub,
    aud: jwtPayload.aud,
    iat: jwtPayload.iat,
    exp: jwtPayload.exp,
    scope: jwtPayload.scope,
  }))
  console.log('[DOCUSIGN] Auth URL:', `https://${config.authServer}/oauth/token`)

  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'RS256' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(jwtPayload)).toString('base64url')

  // Format and sign JWT with private key
  const privateKeyFormatted = formatPrivateKey(config.privateKey)
  console.log('[DOCUSIGN] Private key starts with:', privateKeyFormatted.substring(0, 40))
  console.log('[DOCUSIGN] Private key length:', privateKeyFormatted.length, 'chars,', privateKeyFormatted.split('\n').length, 'lines')

  const crypto = await import('crypto')
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(privateKeyFormatted, 'base64url')
  const jwt = `${header}.${payload}.${signature}`

  console.log('[DOCUSIGN] JWT length:', jwt.length, '— sending token request...')

  const tokenResponse = await fetch(`https://${config.authServer}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text()
    console.error('[DOCUSIGN] Token request failed:', tokenResponse.status, text)
    throw new Error(`DocuSign token request failed: ${tokenResponse.status} - ${text}`)
  }

  const tokenData = await tokenResponse.json()
  cachedToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + (tokenData.expires_in - 60) * 1000,
  }

  console.log('[DOCUSIGN] Access token obtained successfully')
  return cachedToken.token
}

export interface BillOfSaleData {
  sellerName: string
  sellerAddress: string
  sellerLicenceNumber: string
  buyerName: string
  buyerAddress: string
  buyerAbn?: string
  vehicleMake: string
  vehicleModel: string
  vehicleYear: number
  vehicleVin: string
  vehicleRego: string
  vehicleOdometer: number
  vehicleColour?: string
  purchasePrice: number
  sellerEmail: string
  date: string
}

export async function createAndSendEnvelope(data: BillOfSaleData): Promise<string> {
  const config = getConfig()
  const token = await getAccessToken()

  const billOfSaleHtml = generateBillOfSaleHtml(data)
  const htmlBase64 = Buffer.from(billOfSaleHtml).toString('base64')

  const envelopeDefinition = {
    emailSubject: `Bill of Sale — ${data.vehicleYear} ${data.vehicleMake} ${data.vehicleModel}`,
    emailBlurb: `Please review and sign the Bill of Sale for the ${data.vehicleYear} ${data.vehicleMake} ${data.vehicleModel}.`,
    documents: [
      {
        documentBase64: htmlBase64,
        name: 'Bill of Sale',
        fileExtension: 'html',
        documentId: '1',
      },
    ],
    recipients: {
      signers: [
        {
          email: data.sellerEmail,
          name: data.sellerName,
          recipientId: '1',
          routingOrder: '1',
          tabs: {
            signHereTabs: [
              {
                documentId: '1',
                anchorString: '/sig1/',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '-10',
              },
            ],
            dateSignedTabs: [
              {
                documentId: '1',
                anchorString: '/date1/',
                anchorUnits: 'pixels',
                anchorXOffset: '0',
                anchorYOffset: '-10',
              },
            ],
          },
        },
      ],
    },
    status: 'sent',
    eventNotification: {
      url: `${process.env.NEXTAUTH_URL}/api/webhooks/docusign`,
      requireAcknowledgment: 'true',
      loggingEnabled: 'true',
      envelopeEvents: [
        { envelopeEventStatusCode: 'completed' },
        { envelopeEventStatusCode: 'declined' },
        { envelopeEventStatusCode: 'voided' },
      ],
    },
  }

  const response = await fetch(
    `${config.basePath}/v2.1/accounts/${config.accountId}/envelopes`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelopeDefinition),
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`DocuSign create envelope failed: ${response.status} - ${text}`)
  }

  const result = await response.json()
  console.log('[DOCUSIGN] Envelope created:', result.envelopeId)
  return result.envelopeId
}

export async function downloadSignedDocument(envelopeId: string): Promise<Buffer> {
  const config = getConfig()
  const token = await getAccessToken()

  const response = await fetch(
    `${config.basePath}/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}/documents/combined`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/pdf',
      },
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`DocuSign download failed: ${response.status} - ${text}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

function generateBillOfSaleHtml(data: BillOfSaleData): string {
  const formattedPrice = data.purchasePrice.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  const abnLine = data.buyerAbn
    ? `<tr><td>ABN</td><td>${data.buyerAbn}</td></tr>`
    : ''

  const colourLine = data.vehicleColour
    ? `<tr><td>Colour</td><td>${data.vehicleColour}</td></tr>`
    : ''

  return `<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
  h1 { text-align: center; color: #1e40af; margin-bottom: 30px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  td { padding: 8px 12px; border: 1px solid #e2e8f0; }
  td:first-child { background: #f8fafc; font-weight: 600; width: 200px; }
  .section { margin-top: 30px; }
  .section h2 { color: #1e40af; font-size: 16px; border-bottom: 2px solid #1e40af; padding-bottom: 5px; }
  .signature-area { margin-top: 50px; }
  .sig-line { border-bottom: 1px solid #333; width: 300px; margin-top: 40px; }
</style></head>
<body>
  <h1>BILL OF SALE — MOTOR VEHICLE</h1>

  <div class="section">
    <h2>Seller Details</h2>
    <table>
      <tr><td>Name</td><td>${data.sellerName}</td></tr>
      <tr><td>Address</td><td>${data.sellerAddress}</td></tr>
      <tr><td>Licence Number</td><td>${data.sellerLicenceNumber}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Buyer Details</h2>
    <table>
      <tr><td>Name</td><td>${data.buyerName}</td></tr>
      <tr><td>Address</td><td>${data.buyerAddress}</td></tr>
      ${abnLine}
    </table>
  </div>

  <div class="section">
    <h2>Vehicle Details</h2>
    <table>
      <tr><td>Make</td><td>${data.vehicleMake}</td></tr>
      <tr><td>Model</td><td>${data.vehicleModel}</td></tr>
      <tr><td>Year</td><td>${data.vehicleYear}</td></tr>
      <tr><td>VIN</td><td>${data.vehicleVin}</td></tr>
      <tr><td>Registration</td><td>${data.vehicleRego}</td></tr>
      <tr><td>Odometer</td><td>${data.vehicleOdometer.toLocaleString()} km</td></tr>
      ${colourLine}
    </table>
  </div>

  <div class="section">
    <h2>Sale Details</h2>
    <table>
      <tr><td>Purchase Price</td><td>AUD $${formattedPrice} (GST inclusive)</td></tr>
      <tr><td>Date</td><td>${data.date}</td></tr>
    </table>
  </div>

  <p style="margin-top: 30px;">
    The Seller hereby sells and transfers the above-described motor vehicle to the Buyer
    for the consideration stated above. The Seller warrants that they are the lawful owner
    of said vehicle and have the right to sell it. The vehicle is sold in its current condition.
  </p>

  <div class="signature-area">
    <p><strong>Seller Signature:</strong></p>
    <p>/sig1/</p>
    <p><strong>Date:</strong> /date1/</p>
  </div>
</body>
</html>`
}
