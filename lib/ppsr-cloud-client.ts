/**
 * PPSR Cloud B2B API Client
 *
 * Full integration with PPSR Cloud REST API for:
 * 1. Vehicle Lookup (VIN by rego)
 * 2. Motor Vehicle Search (security interest check)
 * 3. Registration by Template (lodge PPSR interest)
 * 4. Discharge Registration (remove PPSR interest)
 *
 * Template logic:
 * - Private individual seller → template "individual" (consumer, no grantors)
 * - Dealer/company seller → template "dealer" (commercial, organisation grantor with ACN)
 *
 * Auth: OAuth2 Client Credentials → /connect/token
 * Base: PPSR_CLOUD_BASE_URL env var
 */

import { redact } from './log-redact'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PpsrCloudConfig {
  baseUrl: string
  clientId: string
  clientSecret: string
  spgNumber: string
}

export interface VehicleLookupResult {
  vin: string | null
  make: string | null
  model: string | null
  year: number | null
  colour: string | null
  bodyType: string | null
  engineNumber: string | null
  registrationPlate: string | null
  registrationState: string | null
  registrationExpiry: string | null
  rawResponse: Record<string, unknown>
}

export interface MvSearchResult {
  searchNumber: string
  searchCertificateNumber: string
  securityInterestExists: boolean
  resultCount: number
  nevdisWrittenOff: boolean
  nevdisStolen: boolean
  registrations: unknown[]
  ppsrCloudId: string
  rawResponse: Record<string, unknown>
}

export interface SearchCertificateResult {
  pdfBase64: string
  fileName: string
}

export interface RegistrationSubmitResult {
  ppsrCloudId: string // GUID for tracking
  rawResponse: Record<string, unknown>
}

export interface RegistrationProgress {
  ppsrCloudId: string
  registrationNumber: string | null
  status: string
  errors: Array<{ code: number; errorDescription: string }>
  rawResponse: Record<string, unknown>
}

export interface RegistrationDetails {
  registrationNumber: string
  startTime: string
  endTime: string
  status: string
  collateralType: string
  grantors: unknown[]
  rawResponse: Record<string, unknown>
}

export interface DischargeResult {
  success: boolean
  ppsrCloudId: string
  rawResponse: Record<string, unknown>
}

export interface SecurityInterestChangedResult {
  hasChanged: boolean
  rawResponse: Record<string, unknown>
}

export interface BusinessSearchResult {
  results: Array<{
    name: string
    abn: string | null
    acn: string | null
    status: string | null
  }>
  rawResponse: Record<string, unknown>
}

export interface BusinessDetailResult {
  name: string
  abn: string | null
  acn: string | null
  gstRegistered: boolean
  gstRegisteredFrom: string | null
  entityType: string | null
  status: string | null
  directors: Array<{ name: string; dateOfBirth?: string }>
  rawResponse: Record<string, unknown>
}

export interface GrantorOrganisation {
  grantorType: 'organisation'
  organisationNumberType: 'acn' | 'abn' | 'arsn' | 'arbn' | 'nameonly'
  organisationNumber?: string
  organisationName?: string
}

export interface GrantorIndividual {
  grantorType: 'individual'
  individualFamilyName: string
  individualGivenNames: string
  individualDateOfBirth: string // yyyy-mm-dd
}

export type Grantor = GrantorOrganisation | GrantorIndividual

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class PpsrCloudError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly errors?: Array<{ code: number; errorDescription: string }>,
    public readonly statusCode?: number
  ) {
    super(message)
    this.name = 'PpsrCloudError'
  }
}

// ---------------------------------------------------------------------------
// Token cache
// ---------------------------------------------------------------------------

let tokenCache: { token: string; expiresAt: number } | null = null

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function getConfig(): PpsrCloudConfig {
  const baseUrl = process.env.PPSR_CLOUD_BASE_URL
  const clientId = process.env.PPSR_CLIENT_ID
  const clientSecret = process.env.PPSR_CLIENT_SECRET
  const spgNumber = process.env.PPSR_SPG_NUMBER

  if (!baseUrl || !clientId || !clientSecret) {
    throw new PpsrCloudError(
      'PPSR Cloud credentials not configured. Set PPSR_CLOUD_BASE_URL, PPSR_CLIENT_ID, PPSR_CLIENT_SECRET.',
      'CONFIG_ERROR'
    )
  }

  if (!spgNumber) {
    throw new PpsrCloudError(
      'PPSR_SPG_NUMBER not configured.',
      'CONFIG_ERROR'
    )
  }

  return { baseUrl: baseUrl.replace(/\/$/, ''), clientId, clientSecret, spgNumber }
}

// ---------------------------------------------------------------------------
// OAuth2 Token
// ---------------------------------------------------------------------------

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token
  }

  const { baseUrl, clientId, clientSecret } = getConfig()
  const tokenUrl = `${baseUrl}/connect/token`

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'integrationaccess',
    client_id: clientId,
    client_secret: clientSecret,
  })

  console.log('[PPSR-Cloud] Requesting OAuth2 token...')

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error('[PPSR-Cloud] Token request failed:', response.status, text.slice(0, 200))
    throw new PpsrCloudError(
      `OAuth2 token request failed: ${response.status} ${response.statusText}`,
      'AUTH_ERROR',
      undefined,
      response.status
    )
  }

  const data = await response.json() as { access_token: string; expires_in: number }

  if (!data.access_token) {
    throw new PpsrCloudError('OAuth2 response missing access_token', 'AUTH_ERROR')
  }

  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  }

  console.log('[PPSR-Cloud] Token obtained, expires in', data.expires_in, 'seconds')
  return data.access_token
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function apiCall<T>(
  endpoint: string,
  body: Record<string, unknown>,
  description: string
): Promise<T> {
  const { baseUrl } = getConfig()
  const token = await getAccessToken()
  const url = `${baseUrl}${endpoint}`

  console.log(`[PPSR-Cloud] ${description}: POST ${endpoint}`)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const responseText = await response.text()

  let data: { resource?: T; errors?: Array<{ code: number; errorDescription: string }>; hasError?: boolean }
  try {
    data = JSON.parse(responseText)
  } catch {
    console.error(`[PPSR-Cloud] Invalid JSON response from ${endpoint}:`, responseText.slice(0, 500))
    throw new PpsrCloudError(
      `Invalid JSON response from ${endpoint}`,
      'PARSE_ERROR',
      undefined,
      response.status
    )
  }

  // Log redacted response
  console.log(`[PPSR-Cloud] ${description} response:`, response.status, JSON.stringify(redact(data)).slice(0, 500))

  if (!response.ok || data.hasError) {
    const errors = data.errors?.map(e => ({
      code: e.code,
      errorDescription: e.errorDescription || (e as unknown as Record<string, string>).message || 'Unknown error',
    }))
    const errorMsg = errors?.map(e => `[${e.code}] ${e.errorDescription}`).join('; ') ||
      `HTTP ${response.status}: ${response.statusText}`
    throw new PpsrCloudError(errorMsg, 'API_ERROR', errors, response.status)
  }

  return (data.resource ?? data) as T
}

// ---------------------------------------------------------------------------
// 1. Vehicle Lookup
// ---------------------------------------------------------------------------

/**
 * Lookup vehicle details by registration plate.
 * Use when VIN is unknown — returns VIN + vehicle details.
 */
export async function vehicleLookup(
  registrationPlate: string,
  registrationPlateState: string,
  options?: { vinLookupOnly?: boolean; advanceResultDetails?: boolean }
): Promise<VehicleLookupResult> {
  const body: Record<string, unknown> = {
    registrationPlate,
    registrationPlateState,
  }
  if (options?.vinLookupOnly) body.vinLookupOnly = true
  if (options?.advanceResultDetails) body.advanceResultDetails = true

  const raw = await apiCall<Record<string, unknown>>(
    '/api/b2b/auvehicle/lookup-mv-info',
    body,
    `Vehicle lookup: ${registrationPlate} (${registrationPlateState})`
  )

  // Response nests vehicle data under details[0]
  const details = (raw.details as Array<Record<string, unknown>>) || []
  const vehicle = details[0] || raw

  return {
    vin: (vehicle.vin as string) || null,
    make: (vehicle.make as string) || null,
    model: (vehicle.model as string) || null,
    year: (vehicle.yearOfManufacture as number) || (vehicle.manufacturerYear as number) || null,
    colour: (vehicle.colour as string) || null,
    bodyType: (vehicle.bodyType as string) || null,
    engineNumber: (vehicle.engineNumber as string) || null,
    registrationPlate: (vehicle.registrationPlate as string) || registrationPlate,
    registrationState: (vehicle.registrationState as string) || registrationPlateState,
    registrationExpiry: (vehicle.registrationExpiry as string) || null,
    rawResponse: raw,
  }
}

// ---------------------------------------------------------------------------
// 2. Motor Vehicle Search
// ---------------------------------------------------------------------------

/**
 * Perform a synchronous MV search by VIN.
 * Returns security interests, NEVDIS flags, and search certificate number.
 * This is the compulsory PPSR search on every deal (all paths).
 */
export async function searchMV(
  vin: string,
  options?: { customerRequestId?: string; reference?: string }
): Promise<MvSearchResult> {
  const body: Record<string, unknown> = {
    vin,
    customerRequestId: options?.customerRequestId || `search-${Date.now()}`,
    reference: options?.reference || `Direct Auto MV Search`,
    pointInTime: null,
  }

  const raw = await apiCall<Record<string, unknown>>(
    '/api/b2b/ausearch/submit-mv',
    body,
    `MV Search: VIN ${vin}`
  )

  return {
    searchNumber: (raw.searchNumber as string) || '',
    searchCertificateNumber: (raw.searchCertificateNumber as string) || '',
    securityInterestExists: (raw.securityInterestExists as boolean) ?? false,
    resultCount: (raw.resultCount as number) ?? 0,
    nevdisWrittenOff: (raw.nevdisWrittenOff as boolean) ?? false,
    nevdisStolen: (raw.nevdisStolen as boolean) ?? false,
    registrations: (raw.registrations as unknown[]) || [],
    ppsrCloudId: (raw.ppsrCloudId as string) || '',
    rawResponse: raw,
  }
}

/**
 * Download the PPSR search certificate PDF.
 */
export async function downloadSearchCertificate(
  searchCertificateNumber: string,
  customerRequestId?: string
): Promise<SearchCertificateResult> {
  const body: Record<string, unknown> = {
    searchCertificateNumber,
    customerRequestId: customerRequestId || `cert-${Date.now()}`,
  }

  const raw = await apiCall<Record<string, unknown>>(
    '/api/b2b/ausearch/mv-root-search-certificate',
    body,
    `Download search certificate: ${searchCertificateNumber}`
  )

  return {
    pdfBase64: (raw.fileContent as string) || (raw.content as string) || '',
    fileName: (raw.fileName as string) || `ppsr-certificate-${searchCertificateNumber}.pdf`,
  }
}

/**
 * Check if security interests have changed since last search (pre-payment validation).
 * Used at step 3.9 — fires before WBC batch to ensure PPSR still clear.
 */
export async function checkSecurityInterestChanged(
  vin: string,
  previousSearchNumber: string
): Promise<SecurityInterestChangedResult> {
  const body: Record<string, unknown> = {
    vin,
    previousSearchNumber,
    customerRequestId: `changed-check-${Date.now()}`,
  }

  const raw = await apiCall<Record<string, unknown>>(
    '/api/b2b/ausearch/mv-security-interest-changed-status',
    body,
    `Security interest changed check: VIN ${vin}`
  )

  return {
    hasChanged: (raw.hasSecurityInterestChanged as boolean) ??
      (raw.hasChanged as boolean) ?? false,
    rawResponse: raw,
  }
}

// ---------------------------------------------------------------------------
// 3. Registration (Lodge PPSR Interest)
// ---------------------------------------------------------------------------

/**
 * Lodge a PPSR registration using a predefined template.
 *
 * Template selection:
 * - "individual" → private seller, consumer registration, NO grantors needed
 * - "dealer" → company/dealer seller, commercial registration, requires organisation grantor
 *
 * @param templateIdentifier - "individual" or "dealer"
 * @param vin - Vehicle Identification Number
 * @param grantors - Required for "dealer" template (organisation with ACN)
 * @param options - Additional options (GONI, autoRenew, etc.)
 */
export async function registerByTemplate(
  templateIdentifier: 'individual' | 'dealer',
  vin: string,
  grantors?: Grantor[],
  options?: {
    givingOfNoticeIdentifier?: string
    autoRenew?: boolean
    expiryInYears?: number
    vehicleRegistrationNumber?: string
    vehicleDescriptiveText?: string
    customerRequestId?: string
  }
): Promise<RegistrationSubmitResult> {
  const { spgNumber } = getConfig()

  const body: Record<string, unknown> = {
    templateIdentifier,
    securedPartyGroupNumber: spgNumber,
    autoRenew: options?.autoRenew ?? true,
    collateralOverrides: [
      {
        serialNumberType: 'VIN',
        serialNumber: vin,
        ...(options?.vehicleRegistrationNumber && { vehicleRegistrationNumber: options.vehicleRegistrationNumber }),
        ...(options?.vehicleDescriptiveText && { vehicleDescriptiveText: options.vehicleDescriptiveText }),
      },
    ],
    ...(options?.givingOfNoticeIdentifier && { givingOfNoticeIdentifier: options.givingOfNoticeIdentifier }),
    ...(options?.expiryInYears && { expiryInYears: options.expiryInYears }),
    ...(options?.customerRequestId && { customerRequestId: options.customerRequestId }),
  }

  // Grantors: required for "dealer", not needed for "individual"
  if (templateIdentifier === 'dealer') {
    if (!grantors || grantors.length === 0) {
      throw new PpsrCloudError(
        'Dealer template requires at least one organisation grantor (ACN/ABN)',
        'VALIDATION_ERROR'
      )
    }
    body.grantors = grantors
  } else if (grantors && grantors.length > 0) {
    // Individual template doesn't need grantors per Xander's guidance
    // but include if explicitly provided
    body.grantors = grantors
  }

  const raw = await apiCall<Record<string, unknown>>(
    '/api/b2b/auregistration/submit-by-template-cmd',
    body,
    `Register by template "${templateIdentifier}": VIN ${vin}`
  )

  return {
    ppsrCloudId: (raw.ppsrCloudId as string) || '',
    rawResponse: raw,
  }
}

/**
 * Check registration progress/status.
 */
export async function checkRegistrationProgress(
  ppsrCloudId: string
): Promise<RegistrationProgress> {
  const body: Record<string, unknown> = {
    auRegistrationIdentifiers: [ppsrCloudId],
  }

  const raw = await apiCall<Record<string, unknown>>(
    '/api/b2b/auregistration/progress',
    body,
    `Check registration progress: ${ppsrCloudId}`
  )

  const progresses = (raw.progresses as Array<Record<string, unknown>>) || []
  const progress = progresses[0] || {}

  return {
    ppsrCloudId,
    registrationNumber: (progress.registrationNumber as string) || null,
    status: (progress.status as string) || (progress.progressStatus as string) || 'unknown',
    errors: (progress.errors as Array<{ code: number; errorDescription: string }>) || [],
    rawResponse: raw,
  }
}

/**
 * Retrieve full registration details.
 */
export async function retrieveRegistration(
  ppsrCloudId: string
): Promise<RegistrationDetails> {
  const body: Record<string, unknown> = {
    auRegistrationIdentifier: ppsrCloudId,
  }

  const raw = await apiCall<Record<string, unknown>>(
    '/api/b2b/auregistration/retrieve-registration',
    body,
    `Retrieve registration: ${ppsrCloudId}`
  )

  return {
    registrationNumber: (raw.registrationNumber as string) || '',
    startTime: (raw.registrationStartTime as string) || (raw.startTime as string) || '',
    endTime: (raw.registrationEndTime as string) || (raw.endTime as string) || '',
    status: (raw.status as string) || '',
    collateralType: (raw.collateralType as string) || '',
    grantors: (raw.grantors as unknown[]) || [],
    rawResponse: raw,
  }
}

// ---------------------------------------------------------------------------
// 4. Discharge Registration
// ---------------------------------------------------------------------------

/**
 * Discharge (remove) a PPSR registration.
 * Called on full payment (Path 1) or cancellation.
 */
export async function dischargeRegistration(
  registrationNumber: string
): Promise<DischargeResult> {
  const { spgNumber } = getConfig()

  const body: Record<string, unknown> = {
    securedPartyGroupNumber: spgNumber,
    registrationNumber,
  }

  const raw = await apiCall<Record<string, unknown>>(
    '/api/b2b/auregistration/discharge-cmd',
    body,
    `Discharge registration: ${registrationNumber}`
  )

  return {
    success: true,
    ppsrCloudId: (raw.ppsrCloudId as string) || '',
    rawResponse: raw,
  }
}

// ---------------------------------------------------------------------------
// Business Register (ABR/ASIC lookup)
// ---------------------------------------------------------------------------

/**
 * Search for a company by name.
 * Used for Type 2/3 seller validation and ABR lookup.
 */
export async function businessSearch(
  searchTerm: string
): Promise<BusinessSearchResult> {
  const body: Record<string, unknown> = { searchTerm }

  const raw = await apiCall<Record<string, unknown>>(
    '/api/b2b/aubusinessregister/search',
    body,
    `Business search: ${searchTerm}`
  )

  // Response nests results under items[]
  const results = (raw.items as Array<Record<string, unknown>>) ||
    (raw.results as Array<Record<string, unknown>>) || []

  return {
    results: results.map(r => ({
      name: (r.organisationName as string) || (r.name as string) || '',
      abn: (r.abn as string) || null,
      acn: (r.acn as string) || null,
      status: (r.abrRegistrationStatus as string) || (r.status as string) || null,
    })),
    rawResponse: raw,
  }
}

/**
 * Get detailed company information by ACN or ABN.
 * Returns GST registration status (needed for Division 66 eligibility).
 */
export async function businessDetail(
  acnOrAbn: string
): Promise<BusinessDetailResult> {
  const body: Record<string, unknown> = { acnOrAbn }

  const raw = await apiCall<Record<string, unknown>>(
    '/api/b2b/aubusinessregister/detail',
    body,
    `Business detail: ${acnOrAbn}`
  )

  const directors = (raw.directors as Array<Record<string, unknown>>) || []

  return {
    name: (raw.name as string) || (raw.organisationName as string) || '',
    abn: (raw.abn as string) || null,
    acn: (raw.acn as string) || null,
    gstRegistered: (raw.gstRegistered as boolean) ?? (raw.isGstRegistered as boolean) ?? false,
    gstRegisteredFrom: (raw.gstRegisteredFrom as string) || null,
    entityType: (raw.entityType as string) || (raw.entityDescription as string) || null,
    status: (raw.status as string) || null,
    directors: directors.map(d => ({
      name: (d.name as string) || `${d.givenName || ''} ${d.familyName || ''}`.trim(),
      dateOfBirth: (d.dateOfBirth as string) || undefined,
    })),
    rawResponse: raw,
  }
}

// ---------------------------------------------------------------------------
// Utility: List existing registrations
// ---------------------------------------------------------------------------

/**
 * List all active registrations for the secured party group.
 */
export async function listRegistrations(options?: {
  pageNumber?: number
  pageSize?: number
}): Promise<{ registrations: unknown[]; totalCount: number; rawResponse: Record<string, unknown> }> {
  const { spgNumber } = getConfig()

  const body: Record<string, unknown> = {
    securedPartyGroupNumber: spgNumber,
    pageNumber: options?.pageNumber || 1,
    pageSize: options?.pageSize || 50,
  }

  const raw = await apiCall<Record<string, unknown>>(
    '/api/b2b/auregistration/list-registrations',
    body,
    'List registrations'
  )

  return {
    registrations: (raw.registrations as unknown[]) || [],
    totalCount: (raw.totalCount as number) || 0,
    rawResponse: raw,
  }
}

// ---------------------------------------------------------------------------
// Convenience: Full registration flow
// ---------------------------------------------------------------------------

/**
 * Complete PPSR registration flow:
 * 1. Register by template
 * 2. Poll progress until registration number is assigned
 * 3. Return final registration details
 *
 * Use for Path 1 deals where deposit triggers auto-lodge.
 */
export async function lodgeAndConfirm(
  templateIdentifier: 'individual' | 'dealer',
  vin: string,
  grantors?: Grantor[],
  options?: {
    givingOfNoticeIdentifier?: string
    autoRenew?: boolean
    maxPollAttempts?: number
    pollIntervalMs?: number
  }
): Promise<{
  ppsrCloudId: string
  registrationNumber: string
  status: string
}> {
  // Step 1: Submit registration
  const submit = await registerByTemplate(templateIdentifier, vin, grantors, {
    givingOfNoticeIdentifier: options?.givingOfNoticeIdentifier,
    autoRenew: options?.autoRenew,
  })

  if (!submit.ppsrCloudId) {
    throw new PpsrCloudError('Registration submitted but no ppsrCloudId returned', 'API_ERROR')
  }

  // Step 2: Poll for completion
  const maxAttempts = options?.maxPollAttempts ?? 10
  const interval = options?.pollIntervalMs ?? 2000

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, interval))

    const progress = await checkRegistrationProgress(submit.ppsrCloudId)

    if (progress.errors.length > 0) {
      throw new PpsrCloudError(
        `Registration failed: ${progress.errors.map(e => e.errorDescription).join('; ')}`,
        'REGISTRATION_FAILED',
        progress.errors
      )
    }

    if (progress.registrationNumber) {
      return {
        ppsrCloudId: submit.ppsrCloudId,
        registrationNumber: progress.registrationNumber,
        status: progress.status,
      }
    }

    console.log(`[PPSR-Cloud] Registration pending, attempt ${attempt}/${maxAttempts}...`)
  }

  // If we get here, registration is still processing
  throw new PpsrCloudError(
    `Registration still processing after ${maxAttempts} attempts. ppsrCloudId: ${submit.ppsrCloudId}`,
    'TIMEOUT'
  )
}

// ---------------------------------------------------------------------------
// Token reset (for testing)
// ---------------------------------------------------------------------------

export function resetTokenCache(): void {
  tokenCache = null
}
