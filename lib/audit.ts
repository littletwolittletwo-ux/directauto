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
  return prisma.auditLog.create({
    data: {
      vehicleId,
      userId,
      action,
      details: details ?? Prisma.JsonNull,
      ipAddress,
    },
  })
}
