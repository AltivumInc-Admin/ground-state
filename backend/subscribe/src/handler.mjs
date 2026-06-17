import { generateToken, hashToken, signSession } from './crypto.mjs'
import { buildSessionCookie } from './cookies.mjs'
import * as defaultStore from './store.mjs'
import * as defaultEmail from './email.mjs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SOURCES = new Set(['signal', 'quantum-intro'])

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

const clientIp = (event) => event.requestContext?.http?.sourceIp ?? 'unknown'

export function makeHandler({ store = defaultStore, email = defaultEmail } = {}) {
  async function subscribe(event) {
    let body
    try {
      body = JSON.parse(event.body || '')
    } catch {
      return json(400, { error: 'invalid_json' })
    }
    // Honeypot: a filled `website` field is a bot. Look successful, do nothing.
    if (typeof body?.website === 'string' && body.website.trim() !== '') {
      return json(200, { ok: true })
    }
    const emailAddr = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!emailAddr || emailAddr.length > 320 || !EMAIL_RE.test(emailAddr)) {
      return json(400, { error: 'invalid_email' })
    }
    const source = body?.source
    if (!SOURCES.has(source)) return json(400, { error: 'invalid_source' })

    const token = generateToken()
    const { alreadyConfirmed } = await store.createPending({
      email: emailAddr,
      source,
      tokenHash: hashToken(token),
      consentIp: clientIp(event),
    })
    if (!alreadyConfirmed) {
      const link = `${process.env.MODULE_URL}/verify?token=${token}`
      await email.sendMagicLink({ to: emailAddr, link })
    }
    // Generic response either way — never reveal membership state.
    return json(200, { ok: true })
  }

  async function verify(event) {
    let body
    try {
      body = JSON.parse(event.body || '')
    } catch {
      return json(400, { error: 'invalid_json' })
    }
    const token = typeof body?.token === 'string' ? body.token : ''
    if (!token || token.length > 256) return json(400, { error: 'invalid_token' })

    const found = await store.consumeToken(hashToken(token))
    if (!found) return json(400, { error: 'invalid_token' })

    const ok = await store.confirm(found.email)
    if (!ok) {
      console.error(JSON.stringify({ at: 'verify_consumed_unconfirmed' }))
      return json(400, { error: 'invalid_token' })
    }

    const ttl = Number(process.env.SESSION_TTL_SEC || '2592000')
    const session = signSession({
      jti: generateToken(),
      exp: Math.floor(Date.now() / 1000) + ttl,
    })
    return {
      statusCode: 200,
      cookies: [buildSessionCookie(session)],
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, next: `${process.env.MODULE_URL}/learn` }),
    }
  }

  return async function handler(event) {
    const method = event.requestContext?.http?.method
    const path = event.rawPath
    try {
      if (method === 'POST' && path === '/subscribe') return await subscribe(event)
      if (method === 'POST' && path === '/verify') return await verify(event)
      return json(404, { error: 'not_found' })
    } catch (err) {
      console.error(JSON.stringify({ at: 'unhandled', route: path, message: err?.message }))
      return json(502, { error: 'upstream_error' })
    }
  }
}

export const handler = makeHandler()
