#!/usr/bin/env npx tsx
/**
 * One-off script: Change the initial PPSR B2G password.
 *
 * PPSR assigns an initial password that MUST be changed via the
 * ChangeB2GPassword SOAP operation before any other operations work.
 *
 * Env vars required:
 *   PPSR_USERNAME          — B2G account username (e.g. "tra5851")
 *   PPSR_INITIAL_PASSWORD  — The initial password assigned by PPSR
 *   PPSR_PASSWORD          — The new password to set
 *   PPSR_API_BASE_URL      — e.g. "https://b2g-disc.ppsr.gov.au"
 *   PPSR_ENVIRONMENT       — "sandbox" or "production"
 *
 * Safety guards:
 *   - Refuses if PPSR_PASSWORD is empty or matches PPSR_INITIAL_PASSWORD
 *   - Refuses if .ppsr-password-changed flag file exists
 *   - Writes flag file on success to prevent accidental re-runs
 */

import * as fs from 'fs'
import * as path from 'path'
import { redact } from '../lib/log-redact'
import { ppsrFetch } from '../lib/ppsr-http'

const FLAG_FILE = path.join(process.cwd(), '.ppsr-password-changed')

// WSDL interface version — using 2011/02 as baseline, update if using newer
const INTERFACE_VERSION = '2011/02'

function buildChangePasswordSoapEnvelope(
  username: string,
  currentPassword: string,
  newPassword: string,
  environment: string
): string {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const messageId = crypto.randomUUID()

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
  xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"
  xmlns:svc="http://schemas.ppsr.gov.au/${INTERFACE_VERSION}/services"
  xmlns:dat="http://schemas.ppsr.gov.au/${INTERFACE_VERSION}/data">
  <soap:Header>
    <wsse:Security soap:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>${escapeXml(username)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escapeXml(currentPassword)}</wsse:Password>
        <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce}</wsse:Nonce>
      </wsse:UsernameToken>
    </wsse:Security>
    <svc:TargetEnvironment>${escapeXml(environment)}</svc:TargetEnvironment>
  </soap:Header>
  <soap:Body>
    <svc:ChangeB2GPasswordRequestMessage>
      <svc:BaseRequestMessage>
        <dat:TargetEnvironment>${escapeXml(environment)}</dat:TargetEnvironment>
      </svc:BaseRequestMessage>
      <svc:ChangeB2GPasswordRequest>
        <dat:CommonRequestType>
          <dat:CustomersRequestMessageId>${messageId}</dat:CustomersRequestMessageId>
        </dat:CommonRequestType>
        <dat:Username>${escapeXml(username)}</dat:Username>
        <dat:CurrentPassword>${escapeXml(currentPassword)}</dat:CurrentPassword>
        <dat:NewPassword>${escapeXml(newPassword)}</dat:NewPassword>
      </svc:ChangeB2GPasswordRequest>
    </svc:ChangeB2GPasswordRequestMessage>
  </soap:Body>
</soap:Envelope>`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function main() {
  console.log('[PPSR-PWD] ========================================')
  console.log('[PPSR-PWD] PPSR B2G Initial Password Change Script')
  console.log('[PPSR-PWD] ========================================')

  // --- Safety checks ---

  if (fs.existsSync(FLAG_FILE)) {
    console.error(
      '[PPSR-PWD] ERROR: Flag file exists at', FLAG_FILE,
      '— password has already been changed. Delete the flag file to run again.'
    )
    process.exit(1)
  }

  const username = process.env.PPSR_USERNAME
  const initialPassword = process.env.PPSR_INITIAL_PASSWORD
  const newPassword = process.env.PPSR_PASSWORD
  const baseUrl = process.env.PPSR_API_BASE_URL
  const environment = process.env.PPSR_ENVIRONMENT || 'sandbox'

  if (!username || !initialPassword || !newPassword || !baseUrl) {
    console.error(
      '[PPSR-PWD] ERROR: Missing required env vars. Need:',
      'PPSR_USERNAME, PPSR_INITIAL_PASSWORD, PPSR_PASSWORD, PPSR_API_BASE_URL'
    )
    process.exit(1)
  }

  if (newPassword === initialPassword) {
    console.error(
      '[PPSR-PWD] ERROR: PPSR_PASSWORD must be different from PPSR_INITIAL_PASSWORD.'
    )
    process.exit(1)
  }

  if (newPassword.length < 8) {
    console.error(
      '[PPSR-PWD] ERROR: PPSR_PASSWORD must be at least 8 characters.'
    )
    process.exit(1)
  }

  const targetEnv = environment === 'production' ? 'Production' : 'Discovery'

  console.log('[PPSR-PWD] Username:', username)
  console.log('[PPSR-PWD] Base URL:', baseUrl)
  console.log('[PPSR-PWD] Target environment:', targetEnv)
  console.log('[PPSR-PWD] Initial password length:', initialPassword.length)
  console.log('[PPSR-PWD] New password length:', newPassword.length)

  // --- Build and send the SOAP request ---

  const soapBody = buildChangePasswordSoapEnvelope(
    username,
    initialPassword,
    newPassword,
    targetEnv
  )

  const endpoint = `${baseUrl}/PpsrB2GService/${INTERFACE_VERSION}/RegisterOperations.svc/soap11`

  console.log('[PPSR-PWD] Endpoint:', endpoint)
  console.log('[PPSR-PWD] Sending ChangeB2GPassword request...')

  try {
    const soapAction = `http://schemas.ppsr.gov.au/${INTERFACE_VERSION}/services/RegisterOperationsService/ChangeB2GPassword`

    const response = await ppsrFetch({
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `"${soapAction}"`,
      },
      body: soapBody,
      timeoutMs: 30_000,
    })

    console.log('[PPSR-PWD] Response status:', response.status, response.statusText)
    console.log('[PPSR-PWD] Response headers:', JSON.stringify(redact(response.headers)))
    console.log('[PPSR-PWD] Response body:', response.body.slice(0, 2000))

    if (response.status === 200 && !response.body.includes('Fault')) {
      console.log('[PPSR-PWD] SUCCESS: Password changed.')
      console.log('[PPSR-PWD] Writing flag file to prevent re-runs...')
      fs.writeFileSync(
        FLAG_FILE,
        `Password changed at ${new Date().toISOString()} for user ${username}\n`
      )
      console.log('[PPSR-PWD] Done. Update PPSR_PASSWORD in your env and remove PPSR_INITIAL_PASSWORD.')
    } else {
      console.error('[PPSR-PWD] FAILED: PPSR returned an error.')
      console.error('[PPSR-PWD] Check the response body above for details.')
      // Log redacted version for structured parsing
      if (response.body.includes('Fault')) {
        const faultMatch = response.body.match(/<faultstring>(.*?)<\/faultstring>/s)
        if (faultMatch) {
          console.error('[PPSR-PWD] Fault string:', faultMatch[1])
        }
      }
      process.exit(2)
    }
  } catch (err) {
    console.error(
      '[PPSR-PWD] Network error:',
      err instanceof Error ? err.message : String(err)
    )
    process.exit(3)
  }
}

main()
