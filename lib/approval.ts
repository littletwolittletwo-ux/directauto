/**
 * Sprint 1 — Purchase Approval Gating Helper
 *
 * Central utility for checking whether a vehicle (car application)
 * has been approved by the accounts team. Every sprint that needs
 * to gate actions behind purchase approval imports this function.
 */

export class ApprovalRequiredError extends Error {
  public readonly statusCode = 403

  constructor(
    public readonly approvalStatus: string,
    message?: string
  ) {
    super(
      message ??
        `Action requires an approved application. Current status: ${approvalStatus}`
    )
    this.name = 'ApprovalRequiredError'
  }
}

/**
 * Throws `ApprovalRequiredError` if the vehicle's `approvalStatus` is not APPROVED.
 *
 * Usage:
 * ```ts
 * import { requireApproved } from '@/lib/approval'
 * requireApproved(vehicle) // throws if not approved
 * ```
 */
export function requireApproved(vehicle: {
  approvalStatus?: string | null
}): void {
  const status = vehicle.approvalStatus ?? 'PENDING'

  if (status !== 'APPROVED') {
    throw new ApprovalRequiredError(status)
  }
}

/**
 * Non-throwing version — returns true if approved, false otherwise.
 */
export function isApproved(vehicle: {
  approvalStatus?: string | null
}): boolean {
  return (vehicle.approvalStatus ?? 'PENDING') === 'APPROVED'
}
