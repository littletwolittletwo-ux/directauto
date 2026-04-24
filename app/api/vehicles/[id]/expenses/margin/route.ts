import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { calculateMargin } from '@/lib/margin'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const margin = await calculateMargin(id)
    return NextResponse.json(margin)
  } catch (error) {
    console.error('[MARGIN] Error:', error)
    return NextResponse.json({ error: 'Failed to calculate margin.' }, { status: 500 })
  }
}
