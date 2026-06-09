/**
 * PPSR Registration Lodgement Service
 *
 * Provides mock, legacy B2G, and PPSR Cloud providers for lodging Motor Vehicle
 * registrations against a Secured Party Group on the PPSR.
 *
 * Switch provider via PPSR_PROVIDER env var: 'mock' | 'real' | 'ppsrcloud'
 *
 * Recommended: 'ppsrcloud' — uses PPSR Cloud B2B REST API with custom templates
 */

import { redact } from './log-redact'
import { ppsrFetch } from './ppsr-http'
import * as ppsrCloud from './ppsr-cloud-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GrantorIndividual {
  type: 'individual'
  familyName: string
  givenNames: string
  dateOfBirth: string // ISO date: "1990-01-15"
}

export interface GrantorOrganisation {
  type: 'organisation'
  organisationNumberType?: 'ABN' | 'ACN' | 'ARBN' | 'ARSN'
  organisationNumber?: string
  organisationName?: string // used if no ABN/ACN
}

export type Grantor = GrantorIndividual | GrantorOrganisation

export interface LodgeRegistrationRequest {
  vehicleVin: string
  vehicleRegistrationNumber?: string
  collateralType: 'Commercial' | 'Consumer'
  registrationEndTime?: string // ISO datetime, defaults to 7 years from now
  isPMSI?: boolean
  isSubordinate?: boolean
  grantors: Grantor[]
  givingOfNoticeIdentifier?: string // optional tracking ref
}

export interface LodgeRegistrationResult {
  registrationNumber: string
  changeNumber: number
  transactionId: number
  registrationStartTime: string
  registrationEndTime: string
  wasEndTimeAdjusted: boolean
  feeCents: number
  rawRequest?: string
  rawResponse?: string
}

export interface GetRegistrationResult {
  registrationNumber: string
  status: string
  rawResponse?: string
}

// ---------------------------------------------------------------------------
// Legacy types (used by API routes)
// ---------------------------------------------------------------------------

export interface LodgementResult {
  registrationNumber: string
  expiresAt: Date
  feeCents: number
  providerReference: string
}

export interface LodgementInput {
  vin: string
  registrationNumber: string
  make: string
  model: string
  year: number
  sellerName: string
}

export interface DischargeResult {
  success: boolean
  dischargedAt: Date
  providerReference: string
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class PpsrError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message)
    this.name = 'PpsrError'
  }
}

/** Backward-compatible alias used by API routes */
export class PPSRError extends Error {
  constructor(message: string, public readonly retryable: boolean = false) {
    super(message)
    this.name = 'PPSRError'
  }
}

export class AuthError extends PpsrError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR', false)
    this.name = 'AuthError'
  }
}

export class ValidationError extends PpsrError {
  constructor(
    message: string,
    public readonly validationErrors?: Array<{
      sequenceNumber?: number
      errorNumber: number
      errorMessage: string
    }>
  ) {
    super(message, 'VALIDATION_ERROR', false)
    this.name = 'ValidationError'
  }
}

export class ConfigError extends PpsrError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', false)
    this.name = 'ConfigError'
  }
}

export class InsufficientCreditError extends PpsrError {
  constructor(message: string) {
    super(message, 'INSUFFICIENT_CREDIT', false)
    this.name = 'InsufficientCreditError'
  }
}

export class IPNotWhitelistedError extends PpsrError {
  constructor(message: string) {
    super(message, 'IP_NOT_WHITELISTED', false)
    this.name = 'IPNotWhitelistedError'
  }
}

export class DuplicateRequestError extends PpsrError {
  constructor(message: string) {
    super(message, 'DUPLICATE_REQUEST', false)
    this.name = 'DuplicateRequestError'
  }
}

export class IdempotencyExpiredError extends PpsrError {
  constructor(message: string) {
    super(message, 'IDEMPOTENCY_EXPIRED', false)
    this.name = 'IdempotencyExpiredError'
  }
}

export class TransientError extends PpsrError {
  constructor(message: string) {
    super(message, 'TRANSIENT_ERROR', true)
    this.name = 'TransientError'
  }
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface PpsrLodgeProvider {
  lodgeRegistration(req: LodgeRegistrationRequest): Promise<LodgeRegistrationResult>
  getRegistration(registrationNumber: string): Promise<GetRegistrationResult>
}

// ---------------------------------------------------------------------------
// WS-Security helpers
// ---------------------------------------------------------------------------

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Build a WS-Security UsernameToken SOAP header.
 * Standard OASIS WS-Security 1.0 with PasswordText.
 */
export function buildWsSecurityHeader(username: string, password: string): string {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  return `<wsse:Security soap:mustUnderstand="1"
    xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
    xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
    <wsse:UsernameToken>
      <wsse:Username>${escapeXml(username)}</wsse:Username>
      <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escapeXml(password)}</wsse:Password>
      <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce}</wsse:Nonce>
    </wsse:UsernameToken>
  </wsse:Security>`
}

/**
 * Generate a unique CustomersRequestMessageId for idempotency.
 * PPSR uses this to deduplicate within 24 hours.
 */
export function generateRequestMessageId(): string {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------------------
// SOAP fault parser
// ---------------------------------------------------------------------------

/**
 * Map PPSR error numbers and WS-Security fault codes to typed errors.
 */
export function mapPpsrFault(faultXml: string): PpsrError {
  // WS-Security faults
  if (faultXml.includes('FailedAuthentication')) {
    return new AuthError('PPSR authentication failed — check B2G username and password')
  }
  if (faultXml.includes('InvalidSecurity')) {
    return new AuthError('PPSR WS-Security header missing or malformed')
  }

  // Extract error number from PpsrSoapFaultDetail
  const errorNumberMatch = faultXml.match(/<[^:]*ErrorNumber[^>]*>(\d+)</)
  const errorNumber = errorNumberMatch ? parseInt(errorNumberMatch[1], 10) : null

  // Extract error message
  const faultStringMatch = faultXml.match(/<faultstring>([\s\S]*?)<\/faultstring>/)
  const errorMessageMatch = faultXml.match(/<[^:]*ErrorMessage[^>]*>(.*?)</)
  const message = errorMessageMatch?.[1] || faultStringMatch?.[1] || 'Unknown PPSR error'

  switch (errorNumber) {
    case 50007:
      return new ConfigError(`Wrong target environment: ${message}`)
    case 50003:
    case 50004:
      return new InsufficientCreditError(`Insufficient credit on PPSR account: ${message}`)
    case 50013:
      return new IPNotWhitelistedError(
        `Source IP not whitelisted — check static IP proxy config: ${message}`
      )
    case 50008:
      return new DuplicateRequestError(
        `Duplicate CustomersRequestMessageId — idempotency hit: ${message}`
      )
    case 50023:
      return new IdempotencyExpiredError(
        `Idempotency window expired (>24h) — generate a new request ID: ${message}`
      )
    case 50026:
      return new TransientError(
        `Request still being processed — retry in a few seconds: ${message}`
      )
    default:
      // Check for validation errors (collateral registration create fault)
      if (faultXml.includes('ValidationError') || faultXml.includes('Validation')) {
        return new ValidationError(`PPSR validation failed: ${message}`)
      }
      // Generic transient for 5xx-like errors
      if (faultXml.includes('InternalError') || faultXml.includes('ServiceUnavailable')) {
        return new TransientError(`PPSR service error: ${message}`)
      }
      return new PpsrError(`PPSR error${errorNumber ? ` (${errorNumber})` : ''}: ${message}`, 'UNKNOWN')
  }
}

// ---------------------------------------------------------------------------
// B2G Config
// ---------------------------------------------------------------------------

function getB2GConfig() {
  const username = process.env.PPSR_USERNAME
  const password = process.env.PPSR_PASSWORD
  const spgNumber = process.env.PPSR_SPG_NUMBER
  const baseUrl = process.env.PPSR_API_BASE_URL
  const environment = process.env.PPSR_ENVIRONMENT || 'sandbox'
  const feeCents = parseInt(process.env.PPSR_REGISTRATION_FEE_CENTS || '600', 10)

  if (!username || !password || !spgNumber || !baseUrl) {
    throw new ConfigError(
      'PPSR B2G credentials not configured. Set PPSR_USERNAME, PPSR_PASSWORD, PPSR_SPG_NUMBER, PPSR_API_BASE_URL.'
    )
  }

  const targetEnvironment = environment === 'production' ? 'Production' : 'Discovery'

  // Using 2011/02 as default interface version; update when WSDL is provided
  const interfaceVersion = '2011/02'
  const collateralRegistrationEndpoint =
    `${baseUrl}/PpsrB2GService/${interfaceVersion}/CollateralRegistration.svc/soap11`

  return {
    username,
    password,
    spgNumber,
    baseUrl,
    environment,
    targetEnvironment,
    interfaceVersion,
    collateralRegistrationEndpoint,
    feeCents,
  }
}

// ---------------------------------------------------------------------------
// Real B2G Provider
// ---------------------------------------------------------------------------

class RealB2GProvider implements PpsrLodgeProvider {
  async lodgeRegistration(req: LodgeRegistrationRequest): Promise<LodgeRegistrationResult> {
    const config = getB2GConfig()

    console.log('[PPSR-B2G] Lodge registration request:', JSON.stringify(redact({
      vin: req.vehicleVin,
      collateralType: req.collateralType,
      grantorCount: req.grantors.length,
      spg: config.spgNumber,
      endpoint: config.collateralRegistrationEndpoint,
    })))

    // TODO: Build CreateRegistrations SOAP envelope — pending WSDL
    // The envelope must include:
    //   - WS-Security header (buildWsSecurityHeader)
    //   - TargetEnvironment header
    //   - CreateRegistrationsRequest body with:
    //     - SecuredPartyGroupNumber
    //     - IsTransitional: false
    //     - CollateralType
    //     - NewCollateralRegistration (VIN, class, end time, etc.)
    //     - Grantors
    //
    // See Phase 1 report for the full request structure.
    // Will be implemented once WSDL is provided.

    void config
    void ppsrFetch
    void buildWsSecurityHeader
    void generateRequestMessageId
    void mapPpsrFault

    throw new PpsrError(
      'Not implemented — pending WSDL from PPSR admin portal',
      'NOT_IMPLEMENTED'
    )
  }

  async getRegistration(registrationNumber: string): Promise<GetRegistrationResult> {
    const config = getB2GConfig()

    console.log('[PPSR-B2G] Get registration:', registrationNumber, 'endpoint:', config.collateralRegistrationEndpoint)

    // TODO: Build RetrieveRegistration SOAP envelope — pending WSDL
    void config

    throw new PpsrError(
      'Not implemented — pending WSDL from PPSR admin portal',
      'NOT_IMPLEMENTED'
    )
  }
}

// ---------------------------------------------------------------------------
// Mock Provider
// ---------------------------------------------------------------------------

class MockProvider implements PpsrLodgeProvider {
  async lodgeRegistration(req: LodgeRegistrationRequest): Promise<LodgeRegistrationResult> {
    console.log('[PPSR-MOCK] Lodge registration for VIN:', req.vehicleVin)

    // Simulate a realistic delay
    await new Promise((r) => setTimeout(r, 500))

    const now = new Date()
    const endTime = new Date(now)
    endTime.setFullYear(endTime.getFullYear() + 7)
    endTime.setHours(23, 59, 59, 0)

    const feeCents = parseInt(process.env.PPSR_REGISTRATION_FEE_CENTS || '600', 10)

    return {
      registrationNumber: `MOCK${Date.now()}`,
      changeNumber: Math.floor(Math.random() * 99999999),
      transactionId: Math.floor(Math.random() * 99999999),
      registrationStartTime: now.toISOString(),
      registrationEndTime: req.registrationEndTime || endTime.toISOString(),
      wasEndTimeAdjusted: false,
      feeCents,
      rawRequest: '[mock — no raw request]',
      rawResponse: '[mock — no raw response]',
    }
  }

  async getRegistration(registrationNumber: string): Promise<GetRegistrationResult> {
    console.log('[PPSR-MOCK] Get registration:', registrationNumber)

    return {
      registrationNumber,
      status: 'current',
      rawResponse: '[mock — no raw response]',
    }
  }
}

// ---------------------------------------------------------------------------
// PPSR Cloud Provider (recommended)
// ---------------------------------------------------------------------------

class PpsrCloudProvider implements PpsrLodgeProvider {
  async lodgeRegistration(req: LodgeRegistrationRequest): Promise<LodgeRegistrationResult> {
    console.log('[PPSR-Cloud] Lodge registration for VIN:', req.vehicleVin, 'type:', req.collateralType)

    // Map collateral type to template:
    // Consumer (individual seller) → "individual" template, no grantors
    // Commercial (dealer/company) → "dealer" template, requires organisation grantor
    const templateIdentifier = req.collateralType === 'Consumer' ? 'individual' : 'dealer'

    // Map grantors to PPSR Cloud format
    let cloudGrantors: ppsrCloud.Grantor[] | undefined
    if (templateIdentifier === 'dealer' && req.grantors.length > 0) {
      cloudGrantors = req.grantors.map(g => {
        if (g.type === 'organisation') {
          return {
            grantorType: 'organisation' as const,
            organisationNumberType: (g.organisationNumberType?.toLowerCase() || 'acn') as 'acn' | 'abn' | 'arsn' | 'arbn' | 'nameonly',
            organisationNumber: g.organisationNumber,
            organisationName: g.organisationName,
          }
        } else {
          return {
            grantorType: 'individual' as const,
            individualFamilyName: g.familyName,
            individualGivenNames: g.givenNames,
            individualDateOfBirth: g.dateOfBirth,
          }
        }
      })
    }

    const result = await ppsrCloud.lodgeAndConfirm(
      templateIdentifier,
      req.vehicleVin,
      cloudGrantors,
      {
        givingOfNoticeIdentifier: req.givingOfNoticeIdentifier,
        autoRenew: true,
      }
    )

    // Calculate dates
    const now = new Date()
    const endTime = new Date(now)
    endTime.setFullYear(endTime.getFullYear() + 7)

    const feeCents = parseInt(process.env.PPSR_REGISTRATION_FEE_CENTS || '600', 10)

    return {
      registrationNumber: result.registrationNumber,
      changeNumber: 0,
      transactionId: 0,
      registrationStartTime: now.toISOString(),
      registrationEndTime: endTime.toISOString(),
      wasEndTimeAdjusted: false,
      feeCents,
      rawRequest: JSON.stringify({ templateIdentifier, vin: req.vehicleVin, grantors: cloudGrantors }),
      rawResponse: JSON.stringify(result),
    }
  }

  async getRegistration(registrationNumber: string): Promise<GetRegistrationResult> {
    // For PPSR Cloud we need the ppsrCloudId, not the registration number
    // If we only have the registration number, list and find it
    console.log('[PPSR-Cloud] Get registration:', registrationNumber)

    // Try listing to find by registration number
    const list = await ppsrCloud.listRegistrations()
    const found = (list.registrations as Array<Record<string, unknown>>).find(
      r => r.registrationNumber === registrationNumber
    )

    if (found && found.ppsrCloudId) {
      const details = await ppsrCloud.retrieveRegistration(found.ppsrCloudId as string)
      return {
        registrationNumber: details.registrationNumber,
        status: details.status,
        rawResponse: JSON.stringify(details.rawResponse),
      }
    }

    return {
      registrationNumber,
      status: 'unknown',
      rawResponse: JSON.stringify({ message: 'Not found in PPSR Cloud listing' }),
    }
  }
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

let _provider: PpsrLodgeProvider | null = null

export function getPpsrLodgeProvider(): PpsrLodgeProvider {
  if (_provider) return _provider

  const providerType = process.env.PPSR_PROVIDER || 'mock'

  switch (providerType) {
    case 'ppsrcloud':
      console.log('[PPSR] Using PPSR Cloud B2B provider')
      _provider = new PpsrCloudProvider()
      break
    case 'real':
      console.log('[PPSR] Using real B2G provider (legacy)')
      _provider = new RealB2GProvider()
      break
    case 'mock':
      console.log('[PPSR] Using mock provider')
      _provider = new MockProvider()
      break
    default:
      throw new ConfigError(`Unknown PPSR_PROVIDER: ${providerType}. Use 'ppsrcloud', 'mock', or 'real'.`)
  }

  return _provider
}

/** Reset provider (for testing) */
export function resetPpsrLodgeProvider(): void {
  _provider = null
}

// ---------------------------------------------------------------------------
// Legacy API — used by existing API routes (lodge/discharge)
// Now delegates to PPSR Cloud when PPSR_PROVIDER=ppsrcloud
// ---------------------------------------------------------------------------

/**
 * Lodge a PPSR registration for a vehicle.
 * Used by: app/api/vehicles/[id]/ppsr/lodge/route.ts
 */
export async function lodge(input: LodgementInput): Promise<LodgementResult> {
  if (!input.vin || input.vin.length < 11) {
    throw new PPSRError('Invalid VIN — must be at least 11 characters', false)
  }

  const providerType = process.env.PPSR_PROVIDER || 'mock'

  if (providerType === 'ppsrcloud') {
    // Use PPSR Cloud B2B API
    const result = await ppsrCloud.lodgeAndConfirm(
      'individual', // Default to individual; caller should use provider directly for dealer
      input.vin,
      undefined,
      { givingOfNoticeIdentifier: `vehicle-${input.registrationNumber}` }
    )

    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 7)
    const feeCents = parseInt(process.env.PPSR_REGISTRATION_FEE_CENTS || '600', 10)

    return {
      registrationNumber: result.registrationNumber,
      expiresAt,
      feeCents,
      providerReference: result.ppsrCloudId,
    }
  }

  // Mock fallback
  await new Promise((r) => setTimeout(r, 1000))

  const regNum = `PPSR-${Date.now().toString(36).toUpperCase()}`
  const expiresAt = new Date()
  expiresAt.setFullYear(expiresAt.getFullYear() + 7)
  const feeCents = parseInt(process.env.PPSR_REGISTRATION_FEE_CENTS || '600', 10)

  return {
    registrationNumber: regNum,
    expiresAt,
    feeCents,
    providerReference: `MOCK-${Date.now()}`,
  }
}

/**
 * Check the status of an existing PPSR registration.
 */
export async function getRegistration(registrationNumber: string) {
  const providerType = process.env.PPSR_PROVIDER || 'mock'

  if (providerType === 'ppsrcloud') {
    const provider = new PpsrCloudProvider()
    const result = await provider.getRegistration(registrationNumber)
    return {
      registrationNumber: result.registrationNumber,
      status: result.status,
      expiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
    }
  }

  await new Promise((r) => setTimeout(r, 500))
  return {
    registrationNumber,
    status: 'active',
    expiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
  }
}

/**
 * Discharge (lift) an existing PPSR registration.
 * Used by: app/api/vehicles/[id]/ppsr/[recordId]/discharge/route.ts
 */
export async function discharge(registrationNumber: string): Promise<DischargeResult> {
  if (!registrationNumber) {
    throw new PPSRError('Registration number is required for discharge', false)
  }

  const providerType = process.env.PPSR_PROVIDER || 'mock'

  if (providerType === 'ppsrcloud') {
    const result = await ppsrCloud.dischargeRegistration(registrationNumber)
    return {
      success: result.success,
      dischargedAt: new Date(),
      providerReference: result.ppsrCloudId,
    }
  }

  await new Promise((r) => setTimeout(r, 800))
  return {
    success: true,
    dischargedAt: new Date(),
    providerReference: `DISCHARGE-${Date.now()}`,
  }
}
