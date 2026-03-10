import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

interface RiskResult {
  riskScore: number
  riskFlags: string[]
  autoBlock: boolean
  suggestedStatus: 'PENDING_VERIFICATION' | 'DOCUMENTS_MISSING' | 'RISK_FLAGGED' | 'APPROVED' | 'REJECTED'
}

function fuzzyNameMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '').trim()
  const na = normalize(a)
  const nb = normalize(b)
  if (na === nb) return true
  // Check if one contains the other (handles middle name differences)
  if (na.includes(nb) || nb.includes(na)) return true
  // Simple Levenshtein-like check: allow up to 2 char difference for typos
  if (Math.abs(na.length - nb.length) > 3) return false
  let diff = 0
  const shorter = na.length < nb.length ? na : nb
  const longer = na.length < nb.length ? nb : na
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] !== longer[i]) diff++
  }
  diff += longer.length - shorter.length
  return diff <= 2
}

export async function calculateRisk(vehicleId: string): Promise<RiskResult> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      identity: true,
      ownership: true,
      ppsrCheck: true,
      documents: true,
    },
  })

  if (!vehicle) throw new Error('Vehicle not found')

  let riskScore = 0
  const riskFlags: string[] = []
  let autoBlock = false

  // PPSR checks
  if (vehicle.ppsrCheck) {
    if (vehicle.ppsrCheck.isWrittenOff) {
      riskScore += 50
      riskFlags.push('Vehicle recorded as written off')
      autoBlock = true
    }
    if (vehicle.ppsrCheck.isStolen) {
      riskScore += 60
      riskFlags.push('Vehicle recorded as stolen')
      autoBlock = true
    }
    if (vehicle.ppsrCheck.hasFinance) {
      riskScore += 40
      riskFlags.push('Finance recorded on PPSR')
    }
  }

  // Name mismatch
  if (vehicle.identity) {
    if (!fuzzyNameMatch(vehicle.sellerName, vehicle.identity.fullLegalName)) {
      riskScore += 30
      riskFlags.push('Seller name does not match licence')
    }

    // Licence expired
    if (vehicle.identity.licenceExpiry < new Date()) {
      riskScore += 25
      riskFlags.push('Driver licence is expired')
    }
  }

  // Documents missing
  const hasLicenceFront = vehicle.documents.some(d => d.category === 'licence-front')
  const hasLicenceBack = vehicle.documents.some(d => d.category === 'licence-back')
  const hasSelfie = vehicle.documents.some(d => d.category === 'selfie')
  const hasOwnershipDoc = vehicle.documents.some(d => d.category === 'ownership')

  if (!hasLicenceFront || !hasLicenceBack || !hasSelfie || !hasOwnershipDoc) {
    riskScore += 20
    riskFlags.push('Required documents not uploaded')
  }

  // Duplicate VIN (other vehicles with same VIN)
  const duplicateVin = await prisma.vehicle.count({
    where: {
      vin: vehicle.vin,
      id: { not: vehicle.id },
    },
  })
  if (duplicateVin > 0) {
    riskScore += 50
    riskFlags.push('VIN already exists in system')
    autoBlock = true
  }

  // Determine suggested status
  let suggestedStatus: RiskResult['suggestedStatus']
  if (autoBlock) {
    suggestedStatus = 'REJECTED'
  } else if (!hasLicenceFront || !hasLicenceBack || !hasSelfie || !hasOwnershipDoc) {
    suggestedStatus = 'DOCUMENTS_MISSING'
  } else if (riskScore > 20) {
    suggestedStatus = 'RISK_FLAGGED'
  } else if (riskScore <= 20) {
    suggestedStatus = 'APPROVED'
  } else {
    suggestedStatus = 'PENDING_VERIFICATION'
  }

  return { riskScore, riskFlags, autoBlock, suggestedStatus }
}

export async function updateVehicleRisk(vehicleId: string): Promise<RiskResult> {
  const risk = await calculateRisk(vehicleId)

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      riskScore: risk.riskScore,
      riskFlags: risk.riskFlags as Prisma.InputJsonValue,
      status: risk.suggestedStatus,
    },
  })

  return risk
}
