/**
 * PPSR Lodgement Service
 *
 * Wraps the PPSR API (or third-party provider). Currently uses a mock/sandbox
 * implementation. Replace the `callProvider` function with real API calls
 * when the [DECIDE] on provider is resolved.
 */

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

class PPSRError extends Error {
  constructor(message: string, public readonly retryable: boolean = false) {
    super(message)
    this.name = 'PPSRError'
  }
}

/**
 * Lodge a PPSR registration for a vehicle.
 *
 * In production, this calls the chosen PPSR provider (B2G or third-party).
 * Currently returns a mock result for development.
 */
export async function lodge(input: LodgementInput): Promise<LodgementResult> {
  // Validate input
  if (!input.vin || input.vin.length < 11) {
    throw new PPSRError('Invalid VIN — must be at least 11 characters', false)
  }

  // --- Mock implementation (replace with real API call) ---
  // Simulate API latency
  await new Promise((r) => setTimeout(r, 1000))

  // Generate a mock registration number
  const regNum = `PPSR-${Date.now().toString(36).toUpperCase()}`

  // 7-year expiry for motor vehicles
  const expiresAt = new Date()
  expiresAt.setFullYear(expiresAt.getFullYear() + 7)

  // Standard PPSR lodgement fee (mock: $6.80 AUD)
  const feeCents = 680

  return {
    registrationNumber: regNum,
    expiresAt,
    feeCents,
    providerReference: `MOCK-${Date.now()}`,
  }
  // --- End mock ---
}

/**
 * Check the status of an existing PPSR registration.
 */
export async function getRegistration(registrationNumber: string) {
  // Mock implementation
  await new Promise((r) => setTimeout(r, 500))

  return {
    registrationNumber,
    status: 'active',
    expiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
  }
}

export { PPSRError }
