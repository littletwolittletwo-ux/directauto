/**
 * DocuSign eSignature REST API client
 * Auth: JWT Grant (server-to-server)
 * Demo environment: account-d.docusign.com / demo.docusign.net
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
  // Trim all values to prevent hidden whitespace/newline issues from env vars
  const integrationKey = (process.env.DOCUSIGN_INTEGRATION_KEY || '').trim()
  const accountId = (process.env.DOCUSIGN_ACCOUNT_ID || '').trim()
  const userId = (process.env.DOCUSIGN_USER_ID || '').trim()
  const privateKey = (process.env.DOCUSIGN_PRIVATE_KEY || '').trim()
  const basePath = (process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi').trim()
  const authServer = (process.env.DOCUSIGN_AUTH_SERVER || 'account-d.docusign.com').trim()

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

  console.log('[DOCUSIGN] === JWT Debug ===')
  console.log('[DOCUSIGN] iss (integrationKey):', `"${jwtPayload.iss}"`, `(len=${jwtPayload.iss.length})`)
  console.log('[DOCUSIGN] sub (userId):', `"${jwtPayload.sub}"`, `(len=${jwtPayload.sub.length})`)
  console.log('[DOCUSIGN] aud:', jwtPayload.aud)
  console.log('[DOCUSIGN] Token URL:', `https://${config.authServer}/oauth/token`)
  console.log('[DOCUSIGN] If issuer_not_found, grant consent at:', `https://${config.authServer}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${jwtPayload.iss}&redirect_uri=${encodeURIComponent(process.env.NEXTAUTH_URL + '/api/auth/docusign/callback')}`)

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
  vehicleTransmission?: string
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
  const blank = '___________'

  return `<!DOCTYPE html>
<html>
<head><style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 40px 50px; color: #000; font-size: 11pt; line-height: 1.5; }
  h1 { text-align: center; font-size: 18pt; margin-bottom: 5px; }
  .subtitle { text-align: center; font-size: 11pt; margin-bottom: 30px; }
  .party { margin-bottom: 20px; }
  .party-label { font-weight: bold; font-size: 12pt; margin-bottom: 5px; }
  .field { margin: 3px 0; }
  .field-label { display: inline-block; width: 200px; }
  .docs { margin: 20px 0; }
  .docs ul { margin: 5px 0; padding-left: 20px; }
  .terms { margin-top: 25px; }
  .terms h3 { font-size: 12pt; margin-bottom: 10px; }
  .terms ol { padding-left: 20px; }
  .terms li { margin-bottom: 10px; }
  .vehicle-table { width: 100%; border-collapse: collapse; margin: 10px 0 20px 0; }
  .vehicle-table td { padding: 4px 10px; border: 1px solid #999; font-size: 10pt; }
  .vehicle-table td:first-child { font-weight: bold; width: 200px; background: #f5f5f5; }
  .signatures { margin-top: 30px; page-break-inside: avoid; }
  .sig-row { margin: 12px 0; }
  .sig-label { display: inline-block; width: 260px; }
  .sig-line { display: inline-block; width: 280px; border-bottom: 1px solid #000; }
</style></head>
<body>

<h1>BILL OF SALE</h1>
<p class="subtitle">This Bill of Sale Agreement is made between:</p>

<div class="party">
  <p class="party-label">Seller:</p>
  <div class="field"><span class="field-label">Name:</span> ${data.sellerName}</div>
  <div class="field"><span class="field-label">Address:</span> ${data.sellerAddress || blank}</div>
  <div class="field"><span class="field-label">Customer ID (NT):</span> ${blank}</div>
  <div class="field"><span class="field-label">Date of Birth:</span> ${blank}</div>
</div>

<div class="party">
  <p class="party-label">Buyer:</p>
  <div class="field"><span class="field-label">Name:</span> ${data.buyerName}</div>
  <div class="field"><span class="field-label">Address:</span> ${data.buyerAddress}</div>
</div>

<div class="docs">
  <p><strong>Documents required:</strong></p>
  <ul>
    <li>Photo of drivers license</li>
    <li>Photo of registration papers</li>
    <li>Photo of VIN</li>
    <li>Top of bank statement</li>
  </ul>
</div>

<div class="terms">
  <h3>TERMS OF BILL OF SALE:</h3>
  <ol>
    <li>Seller hereby sells, and Buyer hereby buys, the following vehicle for <strong>AUD $${formattedPrice}</strong></li>
  </ol>

  <table class="vehicle-table">
    <tr><td>Vehicle Registration Number</td><td>${data.vehicleRego}</td></tr>
    <tr><td>VIN</td><td>${data.vehicleVin}</td></tr>
    <tr><td>Engine No</td><td>${blank}</td></tr>
    <tr><td>Year</td><td>${data.vehicleYear}</td></tr>
    <tr><td>Make</td><td>${data.vehicleMake}</td></tr>
    <tr><td>Model</td><td>${data.vehicleModel}</td></tr>
    <tr><td>Model Year</td><td>${data.vehicleYear}</td></tr>
    <tr><td>Body Shape</td><td>${blank}</td></tr>
    <tr><td>Colour</td><td>${data.vehicleColour || blank}</td></tr>
    <tr><td>Transmission</td><td>${data.vehicleTransmission || blank}</td></tr>
    <tr><td>Fuel</td><td>${blank}</td></tr>
    <tr><td>Odometer</td><td>${data.vehicleOdometer.toLocaleString()} km</td></tr>
    <tr><td>Cyl/Rotors</td><td>${blank}</td></tr>
    <tr><td>Seats</td><td>${blank}</td></tr>
    <tr><td>Number of Doors</td><td>${blank}</td></tr>
  </table>

  <ol start="2">
    <li>The full description and picture of the vehicle as represented by Seller is set out in the Schedule.</li>
    <li>Seller hereby represents and thereby warrants to Buyer:
      <br>(a) there are no legal restrictions preventing Seller from entering into this Bill of Sale Agreement;
      <br>(b) Seller is the sole legal and beneficial owner of the vehicle;
      <br>(c) the vehicle is free of any encumbrances or adverse claims or interests whatsoever;
      <br>(d) Seller will provide to Buyer any and all duly executed documents or forms as are required in order to transfer title in the vehicle free of any encumbrances or adverse claims or interests whatsoever.
    </li>
    <li>Seller hereby covenant to indemnify Buyer against any and all claims and demands, including any expenses and costs incurred by Buyer, by any other party in relation to the ownership of the vehicle.</li>
    <li>Purchase price is <strong>$${formattedPrice}</strong> All inclusive.</li>
  </ol>
</div>

<div class="signatures">
  <p><strong>Executed by the parties as an agreement on</strong></p>

  <div class="sig-row"><span class="sig-label">Date signed:</span> <span class="sig-line">&nbsp;</span></div>

  <div class="sig-row"><span class="sig-label">Signature of Representative:</span> <span class="sig-line">&nbsp;</span></div>
  <div class="sig-row"><span class="sig-label">Name of Signatory:</span> <span class="sig-line">&nbsp;</span></div>
  <div class="sig-row"><span class="sig-label">Position within Company:</span> <span class="sig-line">&nbsp;</span></div>

  <div class="sig-row"><span class="sig-label">In the presence of (Witness):</span> <span class="sig-line">&nbsp;</span></div>
  <div class="sig-row"><span class="sig-label">Print name:</span> <span class="sig-line">&nbsp;</span></div>

  <div class="sig-row"><span class="sig-label">Signature of Buyer:</span> <span style="font-size: 2px; color: white;">/sig1/</span></div>
  <div class="sig-row"><span class="sig-label">&nbsp;</span> <span class="sig-line">&nbsp;</span></div>

  <div class="sig-row"><span class="sig-label">In the presence of (Witness):</span> <span class="sig-line">&nbsp;</span></div>
  <div class="sig-row"><span class="sig-label">Print name:</span> <span class="sig-line">&nbsp;</span></div>

  <p style="font-size: 2px; color: white;">/date1/</p>
</div>

</body>
</html>`
}
