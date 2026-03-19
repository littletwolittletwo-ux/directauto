const rateMap = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(
  ip: string,
  maxRequests?: number,
  windowMs?: number
): { allowed: boolean; remaining: number } {
  const max = maxRequests ?? parseInt(process.env.RATE_LIMIT_MAX || '100') // TODO: change back to 3 before launch
  const window = windowMs ?? parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000')
  const now = Date.now()
  const entry = rateMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + window })
    return { allowed: true, remaining: max - 1 }
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: max - entry.count }
}
