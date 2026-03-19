import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

export async function logAudit({
  vehicleId,
  userId,
  action,
  details,
  ipAddress,
}: {
  vehicleId?: string
  userId?: string
  action: string
  details?: Prisma.InputJsonValue
  ipAddress?: string
}) {
  try {
    return await prisma.auditLog.create({
      data: {
        vehicleId,
        userId,
        action,
        details: details ?? Prisma.JsonNull,
        ipAddress,
      },
    })
  } catch (err) {
    console.error('[AUDIT] Failed to create audit log (non-fatal):', err instanceof Error ? err.message : err)
    return null
  }
}
