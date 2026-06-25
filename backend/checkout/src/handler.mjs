import { createHmac, timingSafeEqual } from 'node:crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

/*
 * Stripe Checkout backend — one Lambda, three routes (HTTP API payload v2):
 *
 *   POST /checkout  { plan: 'monthly' | 'annual', email? }  -> { url }
 *   GET  /session?session_id=cs_...  -> safe status subset for /welcome
 *   POST /webhook   Stripe events, HMAC-verified against the signing secret
 *
 * Deliberately dependency-free: Stripe's REST API over global fetch, and
 * webhook signatures verified with node:crypto. CORS is handled by the
 * API Gateway HTTP API CorsConfiguration, not here — adding headers in
 * both places produces duplicate values and breaks browsers.
 */

const STRIPE_API = 'https://api.stripe.com/v1'
const SIGNATURE_TOLERANCE_SEC = 300
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

// Secrets are fetched from Secrets Manager at cold start, never stored as Lambda
// env vars (which are readable via lambda:GetFunctionConfiguration). Env vars take
// precedence, so local.mjs and the test suite stay synchronous and offline — the
// dynamic import below never runs there.
if (!process.env.STRIPE_SECRET_KEY && process.env.SECRETS_ARN) {
  const { SecretsManagerClient, GetSecretValueCommand } = await import(
    '@aws-sdk/client-secrets-manager'
  )
  const sm = new SecretsManagerClient({})
  const { SecretString } = await sm.send(
    new GetSecretValueCommand({ SecretId: process.env.SECRETS_ARN }),
  )
  const secrets = JSON.parse(SecretString)
  process.env.STRIPE_SECRET_KEY = secrets.STRIPE_SECRET_KEY
  // Webhook secret may be absent until the endpoint is registered — webhook()
  // stays fail-closed (503) while it is.
  if (secrets.STRIPE_WEBHOOK_SECRET) {
    process.env.STRIPE_WEBHOOK_SECRET = secrets.STRIPE_WEBHOOK_SECRET
  }
}

// Webhook idempotency. Exported so tests can stub `send`. Disabled (claimEvent
// returns true) when EVENTS_TABLE is unset, as in local dev and the test suite.
export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const EVENT_TTL_SEC = 60 * 60 * 24 * 7 // 7 days > Stripe's max retry window

async function claimEvent(eventId) {
  if (!process.env.EVENTS_TABLE || typeof eventId !== 'string') return true
  try {
    await ddb.send(
      new PutCommand({
        TableName: process.env.EVENTS_TABLE,
        Item: { PK: `EVT#${eventId}`, ttl: Math.floor(Date.now() / 1000) + EVENT_TTL_SEC },
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    )
    return true // first delivery — claimed
  } catch (err) {
    if (err?.name === 'ConditionalCheckFailedException') return false // already processed
    throw err
  }
}

async function stripeRequest(method, path, params) {
  const res = await fetch(`${STRIPE_API}/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      ...(params && { 'content-type': 'application/x-www-form-urlencoded' }),
    },
    ...(params && { body: new URLSearchParams(params) }),
  })
  const data = await res.json()
  if (!res.ok) {
    // Log the detail server-side; callers only ever see a generic error
    console.error(
      JSON.stringify({
        at: 'stripe_error',
        path,
        status: res.status,
        type: data.error?.type,
        code: data.error?.code,
        message: data.error?.message,
      }),
    )
    throw Object.assign(new Error('stripe_error'), { status: res.status })
  }
  return data
}

async function createCheckout(event) {
  let body
  try {
    body = JSON.parse(event.body || '')
  } catch {
    return json(400, { error: 'invalid_json' })
  }

  const prices = {
    monthly: process.env.PRICE_MONTHLY,
    annual: process.env.PRICE_ANNUAL,
  }
  // Own-property check: keys like '__proto__' or 'toString' resolve truthy
  // through the prototype chain and would otherwise pass the guard
  const plan = body?.plan
  if (typeof plan !== 'string' || !Object.hasOwn(prices, plan)) {
    return json(400, { error: 'invalid_plan' })
  }
  const price = prices[plan]

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (email && (email.length > 320 || !EMAIL_RE.test(email))) {
    return json(400, { error: 'invalid_email' })
  }

  const site = process.env.SITE_URL
  const session = await stripeRequest('POST', 'checkout/sessions', {
    mode: 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    // {CHECKOUT_SESSION_ID} is substituted by Stripe, not by us
    success_url: `${site}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/activate`,
    'metadata[plan]': plan,
    'subscription_data[metadata][tier]': 'round',
    'subscription_data[metadata][plan]': plan,
    ...(email && { customer_email: email }),
  })
  return json(200, { url: session.url })
}

async function getSession(event) {
  const id = event.queryStringParameters?.session_id ?? ''
  if (!/^cs_(test|live)_[A-Za-z0-9]{10,250}$/.test(id)) {
    return json(400, { error: 'invalid_session_id' })
  }
  let s
  try {
    s = await stripeRequest('GET', `checkout/sessions/${id}`)
  } catch (err) {
    return err.status === 404
      ? json(404, { error: 'not_found' })
      : json(502, { error: 'stripe_error' })
  }
  // Only the fields /welcome needs — never the raw session object
  return json(200, {
    status: s.status,
    payment_status: s.payment_status,
    customer_email: s.customer_details?.email ?? null,
    plan: s.metadata?.plan ?? null,
  })
}

/* Stripe-Signature: t=<unix>,v1=<hmac>[,v1=...] — HMAC-SHA256 of
   "<t>.<raw payload>" with the endpoint's signing secret. */
function signatureIsValid(payload, header, secret) {
  if (!header) return false
  let t = null
  const candidates = []
  for (const piece of header.split(',')) {
    const [k, v] = piece.split('=', 2)
    if (k === 't') t = v
    else if (k === 'v1') candidates.push(v)
  }
  if (!t || candidates.length === 0) return false
  // Number('garbage') is NaN, and NaN > tolerance is false — without the
  // finite check a non-numeric timestamp would skip replay protection
  const ts = Number(t)
  if (!Number.isFinite(ts)) return false
  if (Math.abs(Date.now() / 1000 - ts) > SIGNATURE_TOLERANCE_SEC) return false

  const expected = Buffer.from(
    createHmac('sha256', secret).update(`${t}.${payload}`, 'utf8').digest('hex'),
    'utf8',
  )
  return candidates.some((v1) => {
    const got = Buffer.from(v1, 'utf8')
    return got.length === expected.length && timingSafeEqual(got, expected)
  })
}

async function webhook(event) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  // Fail closed: with no signing secret there is no way to authenticate
  if (!secret) return json(503, { error: 'webhook_not_configured' })

  const payload = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
    : (event.body ?? '')
  if (!signatureIsValid(payload, event.headers?.['stripe-signature'], secret)) {
    return json(400, { error: 'invalid_signature' })
  }

  let evt
  try {
    evt = JSON.parse(payload)
  } catch {
    return json(400, { error: 'invalid_payload' })
  }

  // Idempotency: Stripe delivers at-least-once and retries failures. Drop a
  // replayed event before any side effect (logging now; fulfilment later).
  if (!(await claimEvent(evt.id))) {
    return json(200, { received: true, duplicate: true })
  }

  // For now membership activation is manual: these structured logs are the
  // ledger the member system will replace. CloudWatch is the store.
  switch (evt.type) {
    case 'checkout.session.completed': {
      const s = evt.data.object
      console.log(
        JSON.stringify({
          at: 'member_checkout_completed',
          session: s.id,
          email: s.customer_details?.email ?? null,
          plan: s.metadata?.plan ?? null,
          subscription: s.subscription,
          amount_total: s.amount_total,
        }),
      )
      break
    }
    case 'invoice.paid':
    case 'customer.subscription.deleted':
      console.log(JSON.stringify({ at: evt.type, id: evt.data.object?.id }))
      break
    default:
      console.log(JSON.stringify({ at: 'unhandled_event', type: evt.type }))
  }
  return json(200, { received: true })
}

export async function handler(event) {
  const method = event.requestContext?.http?.method
  const path = event.rawPath
  try {
    if (method === 'POST' && path === '/checkout') return await createCheckout(event)
    if (method === 'GET' && path === '/session') return await getSession(event)
    if (method === 'POST' && path === '/webhook') return await webhook(event)
    return json(404, { error: 'not_found' })
  } catch (err) {
    console.error(JSON.stringify({ at: 'unhandled', message: err?.message }))
    return json(502, { error: 'upstream_error' })
  }
}
