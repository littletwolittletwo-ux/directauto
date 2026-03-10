import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { saveFile } from '@/lib/storage'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let settings = await prisma.settings.findUnique({
      where: { id: 'singleton' },
    })

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: 'singleton' },
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('[SETTINGS_GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Require ADMIN role
    if ((session.user as Record<string, unknown>).role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    const contentType = request.headers.get('content-type') || ''
    const updateData: Record<string, unknown> = {}
    let logoFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (with potential logo upload)
      const formData = await request.formData()

      const dealershipName = formData.get('dealershipName') as string | null
      const primaryColor = formData.get('primaryColor') as string | null
      const contactEmail = formData.get('contactEmail') as string | null
      const notifyOnSubmit = formData.get('notifyOnSubmit') as string | null
      const notifyOnPPSR = formData.get('notifyOnPPSR') as string | null
      logoFile = formData.get('logo') as File | null

      if (dealershipName !== null) updateData.dealershipName = dealershipName
      if (primaryColor !== null) updateData.primaryColor = primaryColor
      if (contactEmail !== null) updateData.contactEmail = contactEmail || null
      if (notifyOnSubmit !== null) updateData.notifyOnSubmit = notifyOnSubmit === 'true'
      if (notifyOnPPSR !== null) updateData.notifyOnPPSR = notifyOnPPSR === 'true'
    } else {
      // Handle JSON body
      const body = await request.json()

      const allowedFields = [
        'dealershipName',
        'primaryColor',
        'contactEmail',
        'notifyOnSubmit',
        'notifyOnPPSR',
      ]

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field]
        }
      }
    }

    // Handle logo upload
    if (logoFile && logoFile.size > 0) {
      const buffer = Buffer.from(await logoFile.arrayBuffer())
      const { storagePath } = saveFile(
        buffer,
        'settings',
        'logo',
        logoFile.name,
        logoFile.type
      )
      updateData.logoPath = `/api/documents/static/${storagePath}`
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update.' },
        { status: 400 }
      )
    }

    // Ensure settings record exists
    await prisma.settings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    })

    const settings = await prisma.settings.update({
      where: { id: 'singleton' },
      data: updateData,
    })

    // Log audit
    await logAudit({
      userId: (session.user as Record<string, unknown>).id as string,
      action: 'SETTINGS_UPDATED',
      details: updateData as Prisma.InputJsonValue,
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('[SETTINGS_PATCH] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update settings.' },
      { status: 500 }
    )
  }
}
