import * as defaultStore from './store.mjs'
import * as defaultEmail from './email.mjs'
import { APPLICATION_FIELDS } from './fields.mjs'

// POSTMARK_TOKEN comes from Secrets Manager at cold start, never stored as a
// Lambda env var (readable via lambda:GetFunctionConfiguration). Env wins, so
// tests and local dev stay offline. Apply has no sessions/tokens, so this is
// the only secret it needs.
if (!process.env.POSTMARK_TOKEN && process.env.SECRETS_ARN) {
  const { SecretsManagerClient, GetSecretValueCommand } = await import(
    '@aws-sdk/client-secrets-manager'
  )
  const sm = new SecretsManagerClient({})
  const { SecretString } = await sm.send(
    new GetSecretValueCommand({ SecretId: process.env.SECRETS_ARN }),
  )
  const secrets = JSON.parse(SecretString)
  if (secrets.POSTMARK_TOKEN) process.env.POSTMARK_TOKEN = secrets.POSTMARK_TOKEN
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// The field set (keys, caps, labels) lives in fields.mjs — one source of truth
// shared with store.mjs and email.mjs, so a form change can't silently drop data.
const EMAIL_CAP = APPLICATION_FIELDS.find((f) => f.email).cap
const CAPS = Object.fromEntries(
  APPLICATION_FIELDS.filter((f) => !f.email).map((f) => [f.key, f.cap]),
)
const REQUIRED = Object.keys(CAPS) // every field except email is length-bounded here

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

const clientIp = (event) => event.requestContext?.http?.sourceIp ?? 'unknown'

// Returns { clean } on success or { error } with a 400 error code.
function validate(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || email.length > EMAIL_CAP || !EMAIL_RE.test(email)) return { error: 'invalid_email' }

  const clean = { email }
  for (const f of REQUIRED) {
    const v = typeof body?.[f] === 'string' ? body[f].trim() : ''
    if (!v || v.length > CAPS[f]) return { error: 'invalid_application' }
    clean[f] = v
  }
  return { clean }
}

export function makeHandler({ store = defaultStore, email = defaultEmail } = {}) {
  async function apply(event) {
    // The eight capped fields total ~3.5 kB; anything past 16 kB is not an
    // application. Rejecting before JSON.parse keeps API Gateway's 10 MB
    // ceiling away from the parser.
    if ((event.body?.length ?? 0) > 16384) {
      return json(413, { error: 'payload_too_large' })
    }
    let body
    try {
      body = JSON.parse(event.body || '')
    } catch {
      return json(400, { error: 'invalid_json' })
    }
    // Honeypot: a filled `website` field is a bot. Look successful, do nothing —
    // but leave an investigable, PII-free trace (console.log, not error: a
    // deliberate drop is not an alarm, yet a false positive silently destroys
    // an application without it).
    if (typeof body?.website === 'string' && body.website.trim() !== '') {
      console.log(JSON.stringify({ at: 'honeypot_drop', ip: clientIp(event) }))
      return json(200, { ok: true })
    }

    const { clean, error } = validate(body)
    if (error) return json(400, { error })

    const application = { ...clean, consentIp: clientIp(event) }

    // Persist FIRST — the stored record is the source of truth for the vetting
    // funnel. If the operator notification then fails, log it but still return
    // 200: the application is captured, and a 5xx would only make the founder
    // resubmit and create a duplicate.
    const { id } = await store.putApplication(application)
    try {
      await email.notifyOperator({ application })
    } catch (err) {
      // Correlated: the id points the operator at the exact stored record to
      // follow up on manually when this alarm fires.
      console.error(JSON.stringify({ at: 'notify_failed', id, message: err?.message }))
    }
    return json(200, { ok: true })
  }

  return async function handler(event) {
    const method = event.requestContext?.http?.method
    const path = event.rawPath
    try {
      if (method === 'POST' && path === '/apply') return await apply(event)
      return json(404, { error: 'not_found' })
    } catch (err) {
      console.error(JSON.stringify({ at: 'unhandled', route: path, message: err?.message }))
      return json(502, { error: 'upstream_error' })
    }
  }
}

export const handler = makeHandler()
