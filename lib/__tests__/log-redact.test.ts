import { describe, it, expect } from 'vitest'
import { redact } from '../log-redact'

describe('redact', () => {
  it('redacts a flat object with one credential key', () => {
    const input = { username: 'admin', password: 'hunter2' }
    const result = redact(input)
    expect(result).toEqual({ username: 'admin', password: '[REDACTED]' })
  })

  it('redacts nested objects with credentials at multiple depths', () => {
    const input = {
      user: 'bob',
      auth: {
        token: 'abc123',
        nested: {
          client_secret: 'supersecret',
        },
      },
    }
    const result = redact(input)
    expect(result).toEqual({
      user: 'bob',
      auth: {
        token: '[REDACTED]',
        nested: {
          client_secret: '[REDACTED]',
        },
      },
    })
  })

  it('redacts arrays of objects', () => {
    const input = [
      { name: 'svc1', api_key: 'key1' },
      { name: 'svc2', api_key: 'key2' },
    ]
    const result = redact(input)
    expect(result).toEqual([
      { name: 'svc1', api_key: '[REDACTED]' },
      { name: 'svc2', api_key: '[REDACTED]' },
    ])
  })

  it('handles mixed case keys (Password, PASSWORD, password)', () => {
    const input = {
      Password: 'a',
      PASSWORD: 'b',
      password: 'c',
      pAssWoRd: 'd',
    }
    const result = redact(input)
    expect(result.Password).toBe('[REDACTED]')
    expect(result.PASSWORD).toBe('[REDACTED]')
    expect(result.password).toBe('[REDACTED]')
    expect(result.pAssWoRd).toBe('[REDACTED]')
  })

  it('handles snake_case and camelCase variants', () => {
    const input = {
      access_token: 'tok1',
      accessToken: 'tok2',
      refresh_token: 'tok3',
      refreshToken: 'tok4',
      client_secret: 'sec1',
      clientSecret: 'sec2',
      api_key: 'k1',
      apiKey: 'k2',
      private_key: 'pk1',
      privateKey: 'pk2',
      access_code: 'ac1',
      accessCode: 'ac2',
      'set-cookie': 'cookie1',
      setCookie: 'cookie2',
    }
    const result = redact(input)
    for (const key of Object.keys(input)) {
      expect((result as Record<string, unknown>)[key]).toBe('[REDACTED]')
    }
  })

  it('preserves non-credential keys untouched', () => {
    const input = {
      status: 200,
      message: 'OK',
      data: { count: 5, items: ['a', 'b'] },
      enabled: true,
    }
    const result = redact(input)
    expect(result).toEqual(input)
  })

  it('does not mutate the original input', () => {
    const input = { password: 'secret', name: 'test' }
    const frozen = { ...input }
    redact(input)
    expect(input).toEqual(frozen)
  })

  it('handles circular references without crashing', () => {
    const obj: Record<string, unknown> = { name: 'circular' }
    obj.self = obj
    const result = redact(obj)
    expect(result.name).toBe('circular')
    expect(result.self).toBe('[Circular]')
  })

  it('redacts JWT-shaped strings regardless of key name', () => {
    // A realistic JWT (three base64url segments, each >=4 chars)
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.Gfx6VO9tcxwk6xqx9yYzSfebfeakZp5JYIgP_edcw_A'
    const input = { message: jwt, status: 'ok' }
    const result = redact(input)
    expect(result.message).toBe('[REDACTED]')
    expect(result.status).toBe('ok')
  })

  it('redacts JWT-like strings even in user-provided fields (false positive = safe)', () => {
    // Design decision: redact anything that looks like a JWT,
    // even in fields like "description". False positives are safer than leaks.
    const jwtLike = 'aaaa.bbbb.ccccddddeeeeffffggg'
    const input = { description: jwtLike }
    const result = redact(input)
    expect(result.description).toBe('[REDACTED]')
  })

  it('does NOT redact short dotted strings that are not JWTs', () => {
    // Version strings like "1.2.3" should not be redacted
    const input = { version: '1.2.3', ip: '192.168.1.1' }
    const result = redact(input)
    expect(result.version).toBe('1.2.3')
    expect(result.ip).toBe('192.168.1.1')
  })

  it('handles null, undefined, and primitive inputs', () => {
    expect(redact(null)).toBe(null)
    expect(redact(undefined)).toBe(undefined)
    expect(redact(42)).toBe(42)
    expect(redact(true)).toBe(true)
    expect(redact('hello')).toBe('hello')
  })

  it('redacts authorization and bearer keys', () => {
    const input = {
      authorization: 'Bearer abc123',
      bearer: 'xyz',
      cookie: 'session=abc',
    }
    const result = redact(input)
    expect(result.authorization).toBe('[REDACTED]')
    expect(result.bearer).toBe('[REDACTED]')
    expect(result.cookie).toBe('[REDACTED]')
  })

  it('redacts credentials key', () => {
    const input = { credentials: { user: 'a', pass: 'b' } }
    const result = redact(input)
    expect(result.credentials).toBe('[REDACTED]')
  })

  it('redacts secret key', () => {
    const input = { secret: 'my-secret-value' }
    const result = redact(input)
    expect(result.secret).toBe('[REDACTED]')
  })
})
