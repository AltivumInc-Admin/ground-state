import * as defaultStore from './store.mjs'
import * as defaultEmail from './email.mjs'

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

// Length caps mirror the /apply form's maxLength attributes (src/pages/Apply.jsx).
// Validation is length-bounded, not value-allowlisted, so the backend doesn't
// couple to the frontend's select option copy.
const CAPS = {
  name: 200,
  company: 200,
  role: 200,
  applicantType: 100,
  stage: 100,
  modality: 100,
  want: 2000,
}
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
  if (!email || email.length > 320 || !EMAIL_RE.test(email)) return { error: 'invalid_email' }

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

    const { clean, error } = validate(body)
    if (error) return json(400, { error })

    const application = { ...clean, consentIp: clientIp(event) }

    // Persist FIRST — the stored record is the source of truth for the vetting
    // funnel. If the operator notification then fails, log it but still return
    // 200: the application is captured, and a 5xx would only make the founder
    // resubmit and create a duplicate.
    await store.putApplication(application)
    try {
      await email.notifyOperator({ application })
    } catch (err) {
      console.error(JSON.stringify({ at: 'notify_failed', message: err?.message }))
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
