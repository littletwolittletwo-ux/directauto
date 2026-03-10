import 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: 'ADMIN' | 'STAFF'
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: 'ADMIN' | 'STAFF'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'ADMIN' | 'STAFF'
  }
}
