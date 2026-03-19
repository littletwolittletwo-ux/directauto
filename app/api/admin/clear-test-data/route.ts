import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Find test vehicles (sellerName contains "test" or "banana", case insensitive)
    const testVehicles = await prisma.vehicle.findMany({
      where: {
        OR: [
          { sellerName: { contains: 'test', mode: 'insensitive' } },
          { sellerName: { contains: 'banana', mode: 'insensitive' } },
        ],
      },
      select: { id: true, vin: true, sellerName: true },
    })

    if (testVehicles.length === 0) {
      return NextResponse.json({ message: 'No test vehicles found', deleted: 0 })
    }

    const ids = testVehicles.map((v) => v.id)

    // Delete related records first (cascade should handle most, but be safe)
    await prisma.auditLog.deleteMany({ where: { vehicleId: { in: ids } } })
    await prisma.document.deleteMany({ where: { vehicleId: { in: ids } } })
    await prisma.saleAgreement.deleteMany({ where: { vehicleId: { in: ids } } })
    await prisma.pPSRCheck.deleteMany({ where: { vehicleId: { in: ids } } })
    await prisma.sellerIdentity.deleteMany({ where: { vehicleId: { in: ids } } })
    await prisma.ownershipRecord.deleteMany({ where: { vehicleId: { in: ids } } })
    await prisma.vehicle.deleteMany({ where: { id: { in: ids } } })

    console.log('[CLEAR_TEST_DATA] Deleted', testVehicles.length, 'test vehicles:', testVehicles.map((v) => v.vin))

    return NextResponse.json({
      message: `Deleted ${testVehicles.length} test vehicle(s)`,
      deleted: testVehicles.length,
      vehicles: testVehicles,
    })
  } catch (error) {
    console.error('[CLEAR_TEST_DATA] Error:', error)
    return NextResponse.json({ error: 'Failed to clear test data' }, { status: 500 })
  }
}
