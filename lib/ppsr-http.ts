/**
 * Proxy-aware HTTP transport for PPSR B2G SOAP calls.
 *
 * Reads proxy URL from env vars in priority order:
 *   HTTPS_PROXY > HTTP_PROXY > FIXIE_URL
 *
 * Production requires a proxy (static IP for whitelisting).
 * Sandbox allows no-proxy with a warning for local dev.
 */

import { HttpsProxyAgent } from 'https-proxy-agent'

export interface PpsrHttpConfig {
  proxyUrl: string | null
  environment: string
}

/**
 * Resolve proxy URL from environment variables.
 * Returns null if no proxy is configured.
 */
export function resolveProxyUrl(): string | null {
  return (
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.FIXIE_URL ||
    null
  )
}

/**
 * Get the PPSR environment from env vars. Defaults to 'sandbox'.
 */
export function getPpsrEnvironment(): string {
  return process.env.PPSR_ENVIRONMENT || 'sandbox'
}

/**
 * Validate proxy config for the given environment.
 * Throws on production without proxy. Warns on sandbox without proxy.
 */
export function validateProxyConfig(config: PpsrHttpConfig): void {
  if (!config.proxyUrl && config.environment === 'production') {
    throw new Error(
      'PPSR production requires a static IP proxy. Set HTTPS_PROXY, HTTP_PROXY, or FIXIE_URL.'
    )
  }
  if (!config.proxyUrl && config.environment === 'sandbox') {
    console.warn(
      '[PPSR] WARNING: No proxy configured for sandbox. PPSR B2G requires IP whitelisting — calls may fail.'
    )
  }
}

/**
 * Create an HttpsProxyAgent for the given proxy URL, or null if no proxy.
 */
export function createProxyAgent(proxyUrl: string | null): HttpsProxyAgent<string> | null {
  if (!proxyUrl) return null
  return new HttpsProxyAgent(proxyUrl)
}

export interface PpsrFetchOptions {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

/**
 * Make an HTTP request through the configured proxy (if any).
 * This is the single point of outbound HTTP for all PPSR B2G calls.
 */
export async function ppsrFetch(options: PpsrFetchOptions): Promise<{
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
}> {
  const proxyUrl = resolveProxyUrl()
  const environment = getPpsrEnvironment()
  validateProxyConfig({ proxyUrl, environment })

  const agent = createProxyAgent(proxyUrl)

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? 120_000 // PPSR enforces 120s timeout
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const fetchOptions: RequestInit = {
      method: options.method ?? 'POST',
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
      // @ts-expect-error -- Node.js fetch accepts agent via dispatcher/agent
      agent,
    }

    const response = await fetch(options.url, fetchOptions)
    const body = await response.text()

    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })

    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      body,
    }
  } finally {
    clearTimeout(timer)
  }
}
