import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  resolveProxyUrl,
  getPpsrEnvironment,
  validateProxyConfig,
} from '../ppsr-http'

describe('resolveProxyUrl', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.HTTPS_PROXY
    delete process.env.HTTP_PROXY
    delete process.env.FIXIE_URL
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns null when no proxy env vars are set', () => {
    expect(resolveProxyUrl()).toBeNull()
  })

  it('prefers HTTPS_PROXY over HTTP_PROXY and FIXIE_URL', () => {
    process.env.HTTPS_PROXY = 'http://proxy-a:8080'
    process.env.HTTP_PROXY = 'http://proxy-b:8080'
    process.env.FIXIE_URL = 'http://proxy-c:8080'
    expect(resolveProxyUrl()).toBe('http://proxy-a:8080')
  })

  it('falls back to HTTP_PROXY when HTTPS_PROXY is not set', () => {
    process.env.HTTP_PROXY = 'http://proxy-b:8080'
    process.env.FIXIE_URL = 'http://proxy-c:8080'
    expect(resolveProxyUrl()).toBe('http://proxy-b:8080')
  })

  it('falls back to FIXIE_URL when HTTPS_PROXY and HTTP_PROXY are not set', () => {
    process.env.FIXIE_URL = 'http://proxy-c:8080'
    expect(resolveProxyUrl()).toBe('http://proxy-c:8080')
  })
})

describe('getPpsrEnvironment', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('defaults to sandbox when PPSR_ENVIRONMENT is not set', () => {
    delete process.env.PPSR_ENVIRONMENT
    expect(getPpsrEnvironment()).toBe('sandbox')
  })

  it('returns the env var value when set', () => {
    process.env.PPSR_ENVIRONMENT = 'production'
    expect(getPpsrEnvironment()).toBe('production')
  })
})

describe('validateProxyConfig', () => {
  it('throws when production has no proxy', () => {
    expect(() =>
      validateProxyConfig({ proxyUrl: null, environment: 'production' })
    ).toThrowError('PPSR production requires a static IP proxy')
  })

  it('warns but does not throw when sandbox has no proxy', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() =>
      validateProxyConfig({ proxyUrl: null, environment: 'sandbox' })
    ).not.toThrow()
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No proxy configured for sandbox')
    )
    warnSpy.mockRestore()
  })

  it('does not throw when production has a proxy', () => {
    expect(() =>
      validateProxyConfig({
        proxyUrl: 'http://proxy:8080',
        environment: 'production',
      })
    ).not.toThrow()
  })

  it('does not throw or warn when sandbox has a proxy', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() =>
      validateProxyConfig({
        proxyUrl: 'http://proxy:8080',
        environment: 'sandbox',
      })
    ).not.toThrow()
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
