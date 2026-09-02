/**
 * Session cookie: HMAC-SHA256 signed, HttpOnly. No database, no third party.
 * Payload is `<expiryEpochSeconds>.<randomId>`; the signature covers both.
 */

export interface Env {
  BC_STATE: KVNamespace
  APP_USER: string
  APP_PASS: string
  COOKIE_SECRET: string
  N8N_URL: string
  N8N_SECRET: string
}

const COOKIE_NAME = 'bcksa_session'
const SESSION_TTL_SECONDS = 12 * 60 * 60
const LOGIN_MAX_ATTEMPTS = 5
const LOGIN_LOCK_SECONDS = 15 * 60

const encoder = new TextEncoder()

function base64url(bytes: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)))
}

/** Comparison that does not leak the position of the first differing byte. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function createSessionCookie(env: Env): Promise<string> {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(12)).buffer)
  const payload = `${expiry}.${nonce}`
  const token = `${payload}.${await sign(payload, env.COOKIE_SECRET)}`
  return [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ].join('; ')
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

export async function isLoggedIn(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get('Cookie') || ''
  const match = header.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`))
  if (!match) return false

  const parts = match[1].split('.')
  if (parts.length !== 3) return false
  const [expiry, nonce, signature] = parts

  const expected = await sign(`${expiry}.${nonce}`, env.COOKIE_SECRET)
  if (!safeEqual(signature, expected)) return false

  return Number(expiry) > Math.floor(Date.now() / 1000)
}

/** Per-IP throttle so a shared password cannot be brute forced. */
export async function loginThrottle(request: Request, env: Env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  const key = `login:${ip}`
  const attempts = Number((await env.BC_STATE.get(key)) || 0)
  return {
    locked: attempts >= LOGIN_MAX_ATTEMPTS,
    async fail() {
      await env.BC_STATE.put(key, String(attempts + 1), { expirationTtl: LOGIN_LOCK_SECONDS })
    },
    async reset() {
      await env.BC_STATE.delete(key)
    },
  }
}

export function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(init.headers || {}),
    },
  })
}
