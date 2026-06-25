import { generateToken, hashToken, signSession } from './crypto.mjs'
import * as defaultStore from './store.mjs'
import * as defaultEmail from './email.mjs'

// SESSION_SECRET and TOKEN_PEPPER come from Secrets Manager at cold start, never
// stored as Lambda env vars (readable via lambda:GetFunctionConfiguration).
// crypto.mjs reads them at call-time, so populating process.env before the first
// invocation suffices. Env vars win, so tests and local dev stay offline.
if (!process.env.SESSION_SECRET && process.env.SECRETS_ARN) {
  const { SecretsManagerClient, GetSecretValueCommand } = await import(
    '@aws-sdk/client-secrets-manager'
  )
  const sm = new SecretsManagerClient({})
  const { SecretString } = await sm.send(
    new GetSecretValueCommand({ SecretId: process.env.SECRETS_ARN }),
  )
  const secrets = JSON.parse(SecretString)
  process.env.SESSION_SECRET = secrets.SESSION_SECRET
  process.env.TOKEN_PEPPER = secrets.TOKEN_PEPPER
}

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
      // The confirmation landing page is source-specific: Signal subscribers confirm on the
      // ground-state site; quantum-intro subscribers confirm on the module (which then stores
      // the returned bearer token to unlock content).
      const verifyUrl =
        source === 'signal' ? process.env.SIGNAL_VERIFY_URL : process.env.QUANTUM_VERIFY_URL
      const link = `${verifyUrl}?token=${token}`
      await email.sendMagicLink({ to: emailAddr, link, source })
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
    const accessToken = signSession({
      jti: generateToken(),
      exp: Math.floor(Date.now() / 1000) + ttl,
    })
    // Bearer token in the body (no cookie): the API is cross-site from the module, so the
    // client stores this and sends it as `Authorization: Bearer` to the content API (Plan 2).
    // The Signal /confirm page simply ignores it — confirming the address is all it needs.
    return json(200, { ok: true, token: accessToken })
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
