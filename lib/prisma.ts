import { PrismaClient } from '@prisma/client'

/* eslint-disable @typescript-eslint/no-explicit-any */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
  })

// ─── Column-safety middleware ───────────────────────────────────────
// Fields that may not yet exist in the database.
// The middleware catches "column does not exist" errors and retries
// without these fields so the core app keeps working.

const NEW_VEHICLE_FIELDS = new Set([
  'autograbVehicleId', 'autograbTradeValue', 'autograbRetailValue',
  'autograbColour', 'autograbEngine', 'autograbTransmission', 'autograbBodyType',
  'inspectionCondition', 'inspectionRepairCost', 'inspectionNotes', 'inspectedAt',
  'docusignEnvelopeId', 'docusignStatus', 'docusignSignedAt',
  'purchasePrice', 'offerPrice',
  'accountsApprovedAt', 'accountsApprovedById', 'easycarsSyncedAt',
  'approvalStatus', 'approvalComment',
  'stockStatus',
])

const NEW_FIELD_DEFAULTS: Record<string, unknown> = {
  autograbVehicleId: null,
  autograbTradeValue: null,
  autograbRetailValue: null,
  autograbColour: null,
  autograbEngine: null,
  autograbTransmission: null,
  autograbBodyType: null,
  inspectionCondition: null,
  inspectionRepairCost: null,
  inspectionNotes: null,
  inspectedAt: null,
  docusignEnvelopeId: null,
  docusignStatus: 'NOT_SENT',
  docusignSignedAt: null,
  purchasePrice: null,
  offerPrice: null,
  accountsApprovedAt: null,
  accountsApprovedById: null,
  easycarsSyncedAt: null,
  approvalStatus: 'PENDING',
  approvalComment: null,
  stockStatus: 'AWAITING_DELIVERY',
}

// Base columns guaranteed to exist in the Vehicle table
const VEHICLE_BASE_SELECT: Record<string, boolean> = {
  id: true,
  confirmationNumber: true,
  vin: true,
  registrationNumber: true,
  make: true,
  model: true,
  year: true,
  odometer: true,
  sellerPrice: true,
  location: true,
  sellerName: true,
  sellerPhone: true,
  sellerEmail: true,
  submissionSource: true,
  submissionToken: true,
  ipAddress: true,
  status: true,
  riskScore: true,
  riskFlags: true,
  adminNotes: true,
  sellerSignature: true,
  signedAt: true,
  submittedAt: true,
  createdById: true,
}

function isColumnMissingError(error: unknown): boolean {
  if (error instanceof Error) {
    const m = error.message
    return (m.includes('column') && m.includes('does not exist')) ||
           (m.includes('Unknown arg') && [...NEW_VEHICLE_FIELDS].some(f => m.includes(f)))
  }
  return false
}

function patchResult(result: unknown): unknown {
  if (result === null || result === undefined) return result
  if (Array.isArray(result)) return result.map(patchResult)
  if (typeof result === 'object') return { ...NEW_FIELD_DEFAULTS, ...result }
  return result
}

function stripNewFields(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...data }
  for (const field of NEW_VEHICLE_FIELDS) delete cleaned[field]
  return cleaned
}

function buildSafeSelect(originalInclude?: Record<string, unknown>): Record<string, unknown> {
  const select: Record<string, unknown> = { ...VEHICLE_BASE_SELECT }
  if (originalInclude && typeof originalInclude === 'object') {
    for (const [key, value] of Object.entries(originalInclude)) {
      if (!NEW_VEHICLE_FIELDS.has(key)) select[key] = value
    }
  }
  return select
}

prismaClient.$use(async (params, next) => {
  if (params.model !== 'Vehicle') return next(params)

  try {
    return await next(params)
  } catch (error) {
    if (!isColumnMissingError(error)) throw error

    console.warn('[PRISMA] Missing Vehicle columns detected — retrying with safe query')

    const action = params.action as string

    // READ queries → retry with base select + relation includes
    if (['findUnique', 'findFirst', 'findMany'].includes(action)) {
      const safeSelect = buildSafeSelect(params.args?.include as Record<string, unknown>)
      params.args = { ...params.args, select: safeSelect, include: undefined }
      try {
        const result = await next(params)
        return patchResult(result)
      } catch {
        throw error // re-throw original if retry also fails
      }
    }

    // CREATE → strip new fields from data + use safe select for return
    if (action === 'create') {
      params.args = {
        ...params.args,
        data: stripNewFields(params.args?.data || {}),
        select: { ...VEHICLE_BASE_SELECT },
        include: undefined,
      }
      try {
        const result = await next(params)
        return patchResult(result)
      } catch {
        throw error
      }
    }

    // UPDATE / UPSERT → strip new fields from data
    if (action === 'update' || action === 'upsert') {
      const cleanedData = stripNewFields(params.args?.data || {})
      if (Object.keys(cleanedData).length === 0) {
        // All fields were new columns — skip the update entirely
        console.warn('[PRISMA] Update contained only new fields — skipping')
        return patchResult({ id: (params.args?.where as any)?.id || '' })
      }
      params.args = {
        ...params.args,
        data: cleanedData,
        select: { ...VEHICLE_BASE_SELECT },
        include: undefined,
      }
      try {
        const result = await next(params)
        return patchResult(result)
      } catch {
        throw error
      }
    }

    // count, aggregate, etc. — just rethrow
    throw error
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaClient

export const prisma = prismaClient
export default prisma
