import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const b64url = (buf) => buf.toString('base64url')

export function generateToken() {
  return b64url(randomBytes(32))
}

export function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'utf8')
  const bb = Buffer.from(String(b), 'utf8')
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export function hashToken(token) {
  const pepper = process.env.TOKEN_PEPPER
  if (!pepper) throw new Error('TOKEN_PEPPER not set')
  return createHmac('sha256', pepper).update(token, 'utf8').digest('hex')
}

export function signSession(payload) {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET not set')
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = createHmac('sha256', secret).update(body, 'utf8').digest('hex')
  return `${body}.${sig}`
}

export function verifySession(value) {
  const secret = process.env.SESSION_SECRET
  if (!secret || typeof value !== 'string') return null
  const dot = value.lastIndexOf('.')
  if (dot < 0) return null
  const body = value.slice(0, dot)
  const sig = value.slice(dot + 1)
  const expected = createHmac('sha256', secret).update(body, 'utf8').digest('hex')
  if (!safeEqualHex(sig, expected)) return null
  let payload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof payload?.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null
  return payload
}
