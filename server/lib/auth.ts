import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

/**
 * Session auth for the Sanal Portföy tab.
 *
 * Deliberately dependency-free: node:crypto covers password hashing and cookie
 * signing, so there is no express-session/cookie-parser/bcrypt to keep patched.
 *
 * The password is NEVER stored in the repo. `PORTFOLIO_AUTH_HASH` holds a
 * scrypt digest produced by `scripts/hash-password.mjs`, which the owner runs
 * locally — the plaintext never leaves their terminal.
 *
 * (The app this replaces compared `password === "..."` against a literal
 * committed to a public repo. Not repeating that.)
 */

const COOKIE_NAME = 'eqr_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days — personal, single-user app

// scrypt cost. N=16384 keeps a login around ~50ms on Railway's shared CPU,
// which is slow enough to make offline guessing expensive and fast enough that
// a real login feels instant.
const SCRYPT_N = 16384
const SCRYPT_r = 8
const SCRYPT_p = 1
const KEY_LEN = 64

// ─── password hashing ────────────────────────────────────────────────────────

/** `scrypt$N$r$p$<salt b64>$<hash b64>` */
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const key = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p })
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_r,
    SCRYPT_p,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$')
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, n, r, p, saltB64, hashB64] = parts
  try {
    const salt = Buffer.from(saltB64, 'base64')
    const expected = Buffer.from(hashB64, 'base64')
    const actual = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    })
    // Both buffers are the same length by construction, so timingSafeEqual is
    // safe to call and keeps the comparison constant-time.
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

// ─── signed session cookie ───────────────────────────────────────────────────

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) {
    throw new Error('SESSION_SECRET is missing or too short (need >= 16 chars)')
  }
  return s
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

function makeToken(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({ u: username, exp: Date.now() + SESSION_TTL_MS }),
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function readToken(token: string): { username: string } | null {
  const dot = token.lastIndexOf('.')
  if (dot < 1) return null
  const payload = token.slice(0, dot)
  const mac = token.slice(dot + 1)

  const expectedMac = sign(payload)
  const a = Buffer.from(mac)
  const b = Buffer.from(expectedMac)
  // Length check first: timingSafeEqual throws on mismatched lengths, and the
  // length of an HMAC is not a secret.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      u?: string
      exp?: number
    }
    if (!data.u || !data.exp || Date.now() > data.exp) return null
    return { username: data.u }
  } catch {
    return null
  }
}

/** Minimal cookie header parse — avoids pulling in cookie-parser. */
function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return null
}

export function setSessionCookie(res: Response, username: string) {
  const secure = process.env.NODE_ENV === 'production'
  res.cookie(COOKIE_NAME, makeToken(username), {
    httpOnly: true,
    sameSite: 'strict',
    secure,
    maxAge: SESSION_TTL_MS,
    path: '/',
  })
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' })
}

export function currentUser(req: Request): string | null {
  const token = readCookie(req, COOKIE_NAME)
  if (!token) return null
  return readToken(token)?.username ?? null
}

/** Guards every write against the portfolio database. */
export function requireSession(req: Request, res: Response, next: NextFunction) {
  if (!currentUser(req)) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  next()
}

// ─── login throttle ──────────────────────────────────────────────────────────

// In-memory and per-process, which is fine for a single-instance personal app:
// it exists to make online guessing pointless, not to survive a restart.
const attempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 8
const WINDOW_MS = 15 * 60 * 1000

export function throttleKey(req: Request): string {
  return req.ip ?? 'unknown'
}

export function isThrottled(key: string): boolean {
  const rec = attempts.get(key)
  if (!rec) return false
  if (Date.now() > rec.resetAt) {
    attempts.delete(key)
    return false
  }
  return rec.count >= MAX_ATTEMPTS
}

export function recordFailure(key: string) {
  const rec = attempts.get(key)
  if (!rec || Date.now() > rec.resetAt) {
    attempts.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS })
    return
  }
  rec.count += 1
}

export function clearFailures(key: string) {
  attempts.delete(key)
}
