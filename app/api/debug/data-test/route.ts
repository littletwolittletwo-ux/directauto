import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * TEMPORARY DEBUG ROUTE — remove after diagnosing data loading issue.
 * GET /api/debug/data-test
 *
 * Tests both auth session and data queries without requiring auth.
 */
export async function GET(request: NextRequest) {
  const results: Record<string, unknown> = {}

  // 1. Check session
  try {
    const session = await getServerSession(authOptions)
    results.session = session
      ? {
          exists: true,
          user: session.user,
        }
      : {
          exists: false,
          note: 'getServerSession returned null — this is why /api/vehicles returns 401',
        }
  } catch (err) {
    results.session = {
      error: err instanceof Error ? err.message : String(err),
    }
  }

  // 2. Check env vars relevant to auth
  results.authEnv = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || '(not set)',
    NEXTAUTH_SECRET_SET: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_SECRET_LENGTH: process.env.NEXTAUTH_SECRET?.length || 0,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_URL: process.env.VERCEL_URL || '(not set)',
  }

  // 3. Check cookies being sent
  const cookieHeader = request.headers.get('cookie') || ''
  const cookies = cookieHeader.split(';').map(c => c.trim()).filter(Boolean)
  const sessionCookies = cookies.filter(c =>
    c.startsWith('next-auth') ||
    c.startsWith('__Secure-next-auth') ||
    c.startsWith('__Host-next-auth')
  )
  results.cookies = {
    totalCookies: cookies.length,
    sessionCookies: sessionCookies.map(c => {
      const [name] = c.split('=')
      return name // only show cookie names, not values
    }),
    hasSessionToken: cookies.some(c =>
      c.includes('next-auth.session-token') ||
      c.includes('__Secure-next-auth.session-token')
    ),
  }

  // 4. Query vehicles directly (no auth check)
  try {
    const vehicles = await prisma.vehicle.findMany({
      take: 5,
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        confirmationNumber: true,
        vin: true,
        make: true,
        model: true,
        status: true,
        submittedAt: true,
      },
    })
    const total = await prisma.vehicle.count()
    results.vehicles = {
      total,
      sample: vehicles,
    }
  } catch (err) {
    results.vehicles = {
      error: err instanceof Error ? err.message : String(err),
    }
  }

  // 5. Query users
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
      },
    })
    results.users = users
  } catch (err) {
    results.users = {
      error: err instanceof Error ? err.message : String(err),
    }
  }

  return NextResponse.json(results, { status: 200 })
}
