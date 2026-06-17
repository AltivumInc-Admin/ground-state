import { generateToken, hashToken } from './crypto.mjs'
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

  return async function handler(event) {
    const method = event.requestContext?.http?.method
    const path = event.rawPath
    try {
      if (method === 'POST' && path === '/subscribe') return await subscribe(event)
      return json(404, { error: 'not_found' })
    } catch (err) {
      console.error(JSON.stringify({ at: 'unhandled', route: path, message: err?.message }))
      return json(502, { error: 'upstream_error' })
    }
  }
}

export const handler = makeHandler()
