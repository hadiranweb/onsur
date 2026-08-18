import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { PasswordHasher } from '../ports'

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>

/**
 * scrypt password hasher. Each hash embeds its own random salt; verification
 * uses a constant-time comparison. No external dependencies.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  constructor(private readonly keyLength = 64) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex')
    const derived = await scrypt(password, salt, this.keyLength)
    return `scrypt:${salt}:${derived.toString('hex')}`
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split(':')
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false
    }
    const [, salt, hashHex] = parts
    if (!salt || !hashHex) {
      return false
    }
    let expected: Buffer
    try {
      expected = Buffer.from(hashHex, 'hex')
    } catch {
      return false
    }
    const actual = await scrypt(password, salt, expected.length)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  }
}
