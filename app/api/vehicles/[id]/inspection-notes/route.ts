import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { Prisma } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      select: { adminNotes: true },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    const allNotes = Array.isArray(vehicle.adminNotes) ? vehicle.adminNotes : []
    const inspectionNotes = (allNotes as Record<string, unknown>[]).filter(
      (n) => n.type === 'INSPECTION_NOTE'
    )

    return NextResponse.json({ notes: inspectionNotes })
  } catch (error) {
    console.error('[INSPECTION_NOTES_GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inspection notes.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as { id?: string; name?: string; role?: string }
    if (user.role !== 'ADMIN' && user.role !== 'STAFF') {
      return NextResponse.json(
        { error: 'Forbidden. Admin or Staff access required.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { note } = body

    if (!note || typeof note !== 'string' || !note.trim()) {
      return NextResponse.json(
        { error: 'Note text is required.' },
        { status: 400 }
      )
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      select: { adminNotes: true },
    })

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    const existingNotes = Array.isArray(vehicle.adminNotes)
      ? vehicle.adminNotes
      : []

    const newNote = {
      type: 'INSPECTION_NOTE',
      note: note.trim(),
      userId: user.id || '',
      userName: user.name || '',
      createdAt: new Date().toISOString(),
    }

    const updatedNotes = [...(existingNotes as Record<string, unknown>[]), newNote]

    await prisma.vehicle.update({
      where: { id },
      data: {
        adminNotes: updatedNotes as unknown as Prisma.InputJsonValue,
      },
    })

    await logAudit({
      vehicleId: id,
      userId: user.id,
      action: 'INSPECTION_NOTE_ADDED',
      details: {
        note: note.trim(),
      } as Prisma.InputJsonValue,
    })

    const inspectionNotes = updatedNotes.filter(
      (n) => n.type === 'INSPECTION_NOTE'
    )

    return NextResponse.json({ notes: inspectionNotes }, { status: 201 })
  } catch (error) {
    console.error('[INSPECTION_NOTES_POST] Error:', error)
    return NextResponse.json(
      { error: 'Failed to add inspection note.' },
      { status: 500 }
    )
  }
}
