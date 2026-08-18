import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { SessionCodec } from '../ports'

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function hmacHex(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

/**
 * HMAC-signed session cookie codec.
 *
 * The cookie stores `token.signature`; only the SHA-256 hash of the token is
 * persisted. `AUTH_SECRET` signs the envelope so tampered cookies are rejected
 * before any lookup. Each session gets its own random token (never a shared
 * token used as identity).
 */
export class HmacSessionCodec implements SessionCodec {
  constructor(private readonly secret: string) {}

  create(): { cookieValue: string; tokenHash: string } {
    const token = randomBytes(32).toString('base64url')
    const tokenHash = sha256Hex(token)
    const signature = hmacHex(this.secret, token)
    return { cookieValue: `${token}.${signature}`, tokenHash }
  }

  parse(cookieValue: string | null | undefined): string | null {
    if (!cookieValue) {
      return null
    }
    const separator = cookieValue.lastIndexOf('.')
    if (separator <= 0 || separator === cookieValue.length - 1) {
      return null
    }
    const token = cookieValue.slice(0, separator)
    const signature = cookieValue.slice(separator + 1)
    const expected = hmacHex(this.secret, token)
    if (!safeEqual(signature, expected)) {
      return null
    }
    return sha256Hex(token)
  }
}
