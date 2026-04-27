/**
 * Deep-redaction utility for logging.
 *
 * Replaces credential-bearing keys with "[REDACTED]" and detects JWTs
 * in any string value regardless of key name.
 *
 * Design decision: JWT-shaped strings are ALWAYS redacted even if the
 * key name is innocuous (e.g. a user-provided "message" field). False
 * positives are safer than credential leaks.
 */

const REDACTED = '[REDACTED]'

/**
 * Case-insensitive key patterns that should be redacted.
 * Covers snake_case, camelCase, kebab-case, and SCREAMING_SNAKE variants.
 */
const SENSITIVE_KEY_PATTERNS = [
  /^password$/i,
  /^access[_-]?code$/i,
  /^(access[_-]?)?token$/i,
  /^refresh[_-]?token$/i,
  /^bearer$/i,
  /^authorization$/i,
  /^cookie$/i,
  /^set[_-]?cookie$/i,
  /^client[_-]?secret$/i,
  /^secret$/i,
  /^api[_-]?key$/i,
  /^private[_-]?key$/i,
  /^credentials$/i,
]

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

/**
 * Detect JWT-shaped strings: three base64url segments separated by dots.
 * Each segment must be at least 4 chars of [A-Za-z0-9_-] (with optional
 * = padding). Minimum total length of ~20 to avoid false-positiving on
 * version strings like "1.2.3".
 */
const JWT_PATTERN = /^[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}[=]*$/

function looksLikeJWT(value: string): boolean {
  return value.length >= 20 && JWT_PATTERN.test(value)
}

/**
 * Deep-clone an object/array/primitive with all credential-bearing
 * values replaced by "[REDACTED]".
 *
 * - Never mutates the input
 * - Handles circular references (replaces with "[Circular]")
 * - Redacts JWT-shaped strings in any position
 */
export function redact<T>(input: T): T {
  const seen = new WeakSet()
  return walk(input, seen) as T
}

function walk(value: unknown, seen: WeakSet<object>): unknown {
  // Primitives
  if (value === null || value === undefined) return value
  if (typeof value === 'number' || typeof value === 'boolean') return value

  // Strings: check for JWT shape
  if (typeof value === 'string') {
    return looksLikeJWT(value) ? REDACTED : value
  }

  // Non-plain objects (Date, etc.)
  if (typeof value !== 'object') return value

  // Circular reference guard
  if (seen.has(value as object)) return '[Circular]'
  seen.add(value as object)

  // Arrays
  if (Array.isArray(value)) {
    return value.map((item) => walk(item, seen))
  }

  // Plain objects
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED
    } else {
      result[key] = walk(val, seen)
    }
  }
  return result
}
