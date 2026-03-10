import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Admin-only actions
    const adminOnlyPaths = ['/admin/settings', '/api/vehicles/*/approve', '/api/vehicles/*/reject']
    const isAdminOnly = adminOnlyPaths.some(p => {
      const pattern = p.replace(/\*/g, '[^/]+')
      return new RegExp(`^${pattern}`).test(pathname)
    })

    if (isAdminOnly && token?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname

        // Public routes - always allow
        if (
          pathname.startsWith('/submit') ||
          pathname.startsWith('/api/submit') ||
          pathname.startsWith('/api/documents/upload') ||
          pathname.startsWith('/login') ||
          pathname.startsWith('/api/auth') ||
          pathname.startsWith('/api/debug/') ||
          pathname === '/'
        ) {
          return true
        }

        // Everything else requires auth
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/:path*',
    '/login',
    '/submit/:path*',
  ],
}
