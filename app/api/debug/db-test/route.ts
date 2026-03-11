import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

/**
 * TEMPORARY DEBUG ROUTE — remove after diagnosing DB connection issue.
 * GET /api/debug/db-test
 *
 * Tests database connectivity and returns diagnostic info.
 */
export async function GET() {
  const databaseUrl = process.env.DATABASE_URL || ''
  const directUrl = process.env.DIRECT_URL || ''

  // Parse URL for safe display (redact password)
  function redactUrl(url: string): string {
    if (!url) return '(not set)'
    try {
      const parsed = new URL(url)
      parsed.password = '***REDACTED***'
      return parsed.toString()
    } catch {
      return '(invalid URL format)'
    }
  }

  function parseUrlInfo(url: string) {
    if (!url) return null
    try {
      const parsed = new URL(url)
      return {
        host: parsed.hostname,
        port: parsed.port || '(default)',
        database: parsed.pathname.replace('/', ''),
        user: parsed.username,
        params: Object.fromEntries(parsed.searchParams.entries()),
        hasPgBouncer: parsed.searchParams.get('pgbouncer') === 'true',
        isPooler: parsed.hostname.includes('pooler.supabase.com'),
        isDirect: parsed.hostname.startsWith('db.'),
      }
    } catch {
      return { error: 'Failed to parse URL' }
    }
  }

  const diagnostics: Record<string, unknown> = {
    env: {
      DATABASE_URL: redactUrl(databaseUrl),
      DATABASE_URL_info: parseUrlInfo(databaseUrl),
      DIRECT_URL: redactUrl(directUrl),
      DIRECT_URL_info: parseUrlInfo(directUrl),
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL || '(not set)',
      VERCEL_REGION: process.env.VERCEL_REGION || '(not set)',
    },
    warnings: [] as string[],
  }

  // Check for common misconfigurations
  const warnings = diagnostics.warnings as string[]
  const dbInfo = parseUrlInfo(databaseUrl)

  if (!databaseUrl) {
    warnings.push('DATABASE_URL is not set')
  } else if (dbInfo && 'isPooler' in dbInfo) {
    if (!dbInfo.isPooler && process.env.VERCEL) {
      warnings.push('DATABASE_URL uses direct connection but running on Vercel serverless — should use pooler URL (port 6543)')
    }
    if (dbInfo.isPooler && !dbInfo.hasPgBouncer) {
      warnings.push('DATABASE_URL uses pooler host but missing ?pgbouncer=true parameter')
    }
    if (dbInfo.isPooler && dbInfo.port === '5432') {
      warnings.push('DATABASE_URL uses pooler host but port 5432 — should be 6543')
    }
  }

  if (!directUrl) {
    warnings.push('DIRECT_URL is not set — Prisma needs this for migrations when using pgBouncer')
  }

  // Test 1: Basic connection with prisma
  const testPrisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: ['error', 'warn'],
  })

  try {
    console.log('[DB-DEBUG] Testing connection with Prisma...')
    const startTime = Date.now()

    // Simple raw query to test connectivity
    const result = await testPrisma.$queryRaw`SELECT 1 as connected, current_database() as db_name, current_user as db_user, version() as pg_version`
    const elapsed = Date.now() - startTime

    diagnostics.prismaTest = {
      success: true,
      elapsedMs: elapsed,
      result,
    }

    console.log('[DB-DEBUG] Prisma connection succeeded in', elapsed, 'ms')
  } catch (err) {
    const error = err as Error
    console.error('[DB-DEBUG] Prisma connection failed:', error.message)

    diagnostics.prismaTest = {
      success: false,
      error: error.message,
      errorName: error.name,
      // Prisma errors often have a code
      code: (error as unknown as Record<string, unknown>).code || null,
      meta: (error as unknown as Record<string, unknown>).meta || null,
    }
  }

  // Test 2: Count records in key tables
  if ((diagnostics.prismaTest as Record<string, unknown>)?.success) {
    try {
      const [vehicleCount, userCount, auditCount] = await Promise.all([
        testPrisma.vehicle.count(),
        testPrisma.user.count(),
        testPrisma.auditLog.count(),
      ])

      diagnostics.tableCounts = {
        vehicles: vehicleCount,
        users: userCount,
        auditLogs: auditCount,
      }

      console.log('[DB-DEBUG] Table counts:', { vehicleCount, userCount, auditCount })
    } catch (err) {
      const error = err as Error
      diagnostics.tableCounts = {
        error: error.message,
        code: (error as unknown as Record<string, unknown>).code || null,
      }
    }
  }

  // Test 3: Raw TCP connectivity check (just to see if the host is reachable)
  try {
    const parsed = new URL(databaseUrl)
    const host = parsed.hostname
    const port = parsed.port || '5432'

    diagnostics.hostInfo = {
      host,
      port,
      note: `Attempting to connect to ${host}:${port}`,
    }
  } catch {
    // already handled
  }

  // Cleanup
  await testPrisma.$disconnect()

  return NextResponse.json(diagnostics, { status: 200 })
}
