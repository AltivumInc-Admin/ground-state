import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'

/*
 * The revenue path's edge cases, committed. These were first exercised by
 * hand (commit 2330a90); a red test here blocks the Amplify deploy via
 * the preBuild `npm test` gate. Zero dependencies, like the handler:
 * Stripe is never contacted — fetch is mocked where a test would reach it.
 *
 * Lives in test/ (not src/) so `sam build` never packages it into the
 * Lambda artifact (template.yaml CodeUri is src/).
 */

process.env.PRICE_MONTHLY = 'price_test_monthly'
process.env.PRICE_ANNUAL = 'price_test_annual'
process.env.SITE_URL = 'https://example.test'
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
delete process.env.STRIPE_WEBHOOK_SECRET

const { handler, ddb } = await import('../src/handler.mjs')

const event = ({
  method = 'POST',
  path = '/checkout',
  body,
  headers = {},
  query,
  isBase64Encoded = false,
} = {}) => ({
  rawPath: path,
  requestContext: { http: { method } },
  headers,
  queryStringParameters: query,
  body: typeof body === 'string' || body === undefined ? body : JSON.stringify(body),
  isBase64Encoded,
})

const WEBHOOK_SECRET = 'whsec_test_secret'

const sign = (payload, secret = WEBHOOK_SECRET, t = Math.floor(Date.now() / 1000)) =>
  `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${payload}`, 'utf8').digest('hex')}`

const COMPLETED_EVENT = JSON.stringify({
  id: 'evt_test_completed',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_abc',
      customer_details: { email: 'founder@example.test' },
      metadata: { plan: 'monthly' },
      subscription: 'sub_123',
      amount_total: 30000,
    },
  },
})

/* ---------------------------------------------------------------- routing */

test('unknown path returns 404', async () => {
  const res = await handler(event({ path: '/nope' }))
  assert.equal(res.statusCode, 404)
  assert.equal(JSON.parse(res.body).error, 'not_found')
})

test('wrong method on /checkout returns 404', async () => {
  const res = await handler(event({ method: 'GET', path: '/checkout' }))
  assert.equal(res.statusCode, 404)
})

test('wrong method on /session returns 404', async () => {
  const res = await handler(event({ method: 'POST', path: '/session' }))
  assert.equal(res.statusCode, 404)
})

/* --------------------------------------------------- /checkout plan guard */

test('missing plan is rejected', async () => {
  const res = await handler(event({ body: {} }))
  assert.equal(res.statusCode, 400)
  assert.equal(JSON.parse(res.body).error, 'invalid_plan')
})

for (const plan of ['__proto__', 'toString', 'constructor', 'hasOwnProperty', 'weekly']) {
  test(`prototype-chain / unknown plan "${plan}" is rejected`, async () => {
    const res = await handler(event({ body: { plan } }))
    assert.equal(res.statusCode, 400)
    assert.equal(JSON.parse(res.body).error, 'invalid_plan')
  })
}

test('non-string plan is rejected', async () => {
  for (const plan of [123, null, { monthly: true }, ['monthly']]) {
    const res = await handler(event({ body: { plan } }))
    assert.equal(res.statusCode, 400, `plan=${JSON.stringify(plan)}`)
    assert.equal(JSON.parse(res.body).error, 'invalid_plan')
  }
})

/* ------------------------------------------------ /checkout body + email */

test('malformed JSON body is rejected', async () => {
  const res = await handler(event({ body: 'not json {' }))
  assert.equal(res.statusCode, 400)
  assert.equal(JSON.parse(res.body).error, 'invalid_json')
})

test('empty body is rejected as invalid JSON', async () => {
  const res = await handler(event({ body: undefined }))
  assert.equal(res.statusCode, 400)
  assert.equal(JSON.parse(res.body).error, 'invalid_json')
})

test('overlong email is rejected', async () => {
  const email = `${'a'.repeat(315)}@x.test`
  const res = await handler(event({ body: { plan: 'monthly', email } }))
  assert.equal(res.statusCode, 400)
  assert.equal(JSON.parse(res.body).error, 'invalid_email')
})

test('malformed email is rejected', async () => {
  const res = await handler(event({ body: { plan: 'monthly', email: 'nope' } }))
  assert.equal(res.statusCode, 400)
  assert.equal(JSON.parse(res.body).error, 'invalid_email')
})

/* ------------------------------------------------- /checkout happy path */

test('valid plan creates a checkout session with the server-held price', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions')
    assert.equal(opts.headers.authorization, 'Bearer sk_test_dummy')
    const params = new URLSearchParams(opts.body)
    assert.equal(params.get('mode'), 'subscription')
    assert.equal(params.get('line_items[0][price]'), 'price_test_monthly')
    assert.equal(params.get('line_items[0][quantity]'), '1')
    assert.ok(params.get('success_url').includes('{CHECKOUT_SESSION_ID}'))
    assert.equal(params.get('cancel_url'), 'https://example.test/activate')
    assert.equal(params.get('customer_email'), 'founder@example.test')
    return new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/x' }), {
      status: 200,
    })
  })
  const res = await handler(
    event({ body: { plan: 'monthly', email: 'founder@example.test' } }),
  )
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).url, 'https://checkout.stripe.com/c/pay/x')
})

test('annual plan maps to the annual price; email omitted when absent', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, opts) => {
    const params = new URLSearchParams(opts.body)
    assert.equal(params.get('line_items[0][price]'), 'price_test_annual')
    assert.equal(params.get('customer_email'), null)
    return new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/y' }), {
      status: 200,
    })
  })
  const res = await handler(event({ body: { plan: 'annual' } }))
  assert.equal(res.statusCode, 200)
})

test('a network failure surfaces as 502 upstream_error with ONE alarmed stripe_error line', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('socket hang up')
  })
  const errSpy = t.mock.method(console, 'error', () => {})
  const res = await handler(event({ body: { plan: 'monthly' } }))
  assert.equal(res.statusCode, 502)
  assert.equal(JSON.parse(res.body).error, 'upstream_error')
  // stripeRequest is the single logging layer: exactly one stripe_error
  // (network-flagged), and NO unhandled line — that tag is reserved for bugs.
  const lines = errSpy.mock.calls.map((c) => JSON.parse(c.arguments[0]))
  assert.equal(lines.filter((l) => l.at === 'stripe_error').length, 1)
  assert.equal(lines[0].network, true)
  assert.equal(lines.filter((l) => l.at === 'unhandled').length, 0)
})

test('a hung Stripe aborts at the fetch timeout and surfaces as the same 502', async (t) => {
  // AbortSignal.timeout rejects with a TimeoutError — it must ride the existing
  // error plumbing, not escape as a Lambda-killing hang.
  t.mock.method(globalThis, 'fetch', async () => {
    throw Object.assign(new Error('The operation was aborted due to timeout'), {
      name: 'TimeoutError',
    })
  })
  const errSpy = t.mock.method(console, 'error', () => {})
  const res = await handler(event({ body: { plan: 'monthly' } }))
  assert.equal(res.statusCode, 502)
  assert.equal(JSON.parse(res.body).error, 'upstream_error')
  const line = JSON.parse(errSpy.mock.calls[0].arguments[0])
  assert.equal(line.at, 'stripe_error')
  assert.equal(line.name, 'TimeoutError')
})

/* -------------------------------------------------------------- /session */

for (const id of ['', 'abc', 'cs_test_short', `cs_live_${'A'.repeat(251)}`, 'cs_test_<script>']) {
  test(`session id ${JSON.stringify(id.slice(0, 24))} is rejected by the format guard`, async () => {
    const res = await handler(
      event({ method: 'GET', path: '/session', query: { session_id: id } }),
    )
    assert.equal(res.statusCode, 400)
    assert.equal(JSON.parse(res.body).error, 'invalid_session_id')
  })
}

test('session response is the four-field allowlist, nothing else', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    return new Response(
      JSON.stringify({
        id: 'cs_test_abcdefghijkl',
        status: 'complete',
        payment_status: 'paid',
        customer_details: { email: 'founder@example.test', phone: '+15555550100' },
        metadata: { plan: 'annual' },
        client_secret: 'SHOULD_NEVER_LEAK',
        subscription: 'sub_123',
      }),
      { status: 200 },
    )
  })
  const res = await handler(
    event({ method: 'GET', path: '/session', query: { session_id: 'cs_test_abcdefghijkl' } }),
  )
  assert.equal(res.statusCode, 200)
  const body = JSON.parse(res.body)
  assert.deepEqual(Object.keys(body).sort(), ['customer_email', 'payment_status', 'plan', 'status'])
  assert.equal(body.status, 'complete')
  assert.equal(body.payment_status, 'paid')
  assert.equal(body.customer_email, 'founder@example.test')
  assert.equal(body.plan, 'annual')
})

test('Stripe 404 maps to not_found, other failures to stripe_error', async (t) => {
  let status = 404
  t.mock.method(globalThis, 'fetch', async () => {
    return new Response(JSON.stringify({ error: { type: 'invalid_request_error' } }), { status })
  })
  const notFound = await handler(
    event({ method: 'GET', path: '/session', query: { session_id: 'cs_test_abcdefghijkl' } }),
  )
  assert.equal(notFound.statusCode, 404)
  assert.equal(JSON.parse(notFound.body).error, 'not_found')

  status = 500
  const upstream = await handler(
    event({ method: 'GET', path: '/session', query: { session_id: 'cs_test_abcdefghijkl' } }),
  )
  assert.equal(upstream.statusCode, 502)
  assert.equal(JSON.parse(upstream.body).error, 'stripe_error')
})

/* -------------------------------------------------------------- /webhook */

const webhookEvent = (payload, signature, extra = {}) =>
  event({
    path: '/webhook',
    body: payload,
    headers: signature === undefined ? {} : { 'stripe-signature': signature },
    ...extra,
  })

test('webhook fails closed when no signing secret is configured', async () => {
  delete process.env.STRIPE_WEBHOOK_SECRET
  const res = await handler(webhookEvent(COMPLETED_EVENT, sign(COMPLETED_EVENT)))
  assert.equal(res.statusCode, 503)
  assert.equal(JSON.parse(res.body).error, 'webhook_not_configured')
})

test('valid signature is accepted', async (t) => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  t.after(() => delete process.env.STRIPE_WEBHOOK_SECRET)
  const res = await handler(webhookEvent(COMPLETED_EVENT, sign(COMPLETED_EVENT)))
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { received: true })
})

test('tampered payload is rejected', async (t) => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  t.after(() => delete process.env.STRIPE_WEBHOOK_SECRET)
  const res = await handler(webhookEvent(COMPLETED_EVENT.replace('monthly', 'lifetime'), sign(COMPLETED_EVENT)))
  assert.equal(res.statusCode, 400)
  assert.equal(JSON.parse(res.body).error, 'invalid_signature')
})

test('signature from the wrong secret is rejected', async (t) => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  t.after(() => delete process.env.STRIPE_WEBHOOK_SECRET)
  const res = await handler(webhookEvent(COMPLETED_EVENT, sign(COMPLETED_EVENT, 'whsec_wrong')))
  assert.equal(res.statusCode, 400)
})

test('stale and future timestamps are rejected (replay window)', async (t) => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  t.after(() => delete process.env.STRIPE_WEBHOOK_SECRET)
  const now = Math.floor(Date.now() / 1000)
  for (const ts of [now - 301, now + 301]) {
    const res = await handler(webhookEvent(COMPLETED_EVENT, sign(COMPLETED_EVENT, WEBHOOK_SECRET, ts)))
    assert.equal(res.statusCode, 400, `t=${ts - now}s`)
    assert.equal(JSON.parse(res.body).error, 'invalid_signature')
  }
})

test('timestamps just inside the tolerance are accepted', async (t) => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  t.after(() => delete process.env.STRIPE_WEBHOOK_SECRET)
  const now = Math.floor(Date.now() / 1000)
  const res = await handler(webhookEvent(COMPLETED_EVENT, sign(COMPLETED_EVENT, WEBHOOK_SECRET, now - 290)))
  assert.equal(res.statusCode, 200)
})

test('non-numeric timestamp is rejected (NaN regression)', async (t) => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  t.after(() => delete process.env.STRIPE_WEBHOOK_SECRET)
  // An HMAC computed over the garbage timestamp is otherwise internally
  // consistent — only the finite-number check stands in the way
  const t0 = 'garbage'
  const v1 = createHmac('sha256', WEBHOOK_SECRET).update(`${t0}.${COMPLETED_EVENT}`, 'utf8').digest('hex')
  const res = await handler(webhookEvent(COMPLETED_EVENT, `t=${t0},v1=${v1}`))
  assert.equal(res.statusCode, 400)
  assert.equal(JSON.parse(res.body).error, 'invalid_signature')
})

test('missing and malformed signature headers are rejected', async (t) => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  t.after(() => delete process.env.STRIPE_WEBHOOK_SECRET)
  for (const sig of [undefined, '', 'garbage', 't=123', 'v1=deadbeef']) {
    const res = await handler(webhookEvent(COMPLETED_EVENT, sig))
    assert.equal(res.statusCode, 400, `signature=${JSON.stringify(sig)}`)
  }
})

test('base64-encoded webhook body verifies against the decoded payload', async (t) => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  t.after(() => delete process.env.STRIPE_WEBHOOK_SECRET)
  const res = await handler(
    webhookEvent(Buffer.from(COMPLETED_EVENT, 'utf8').toString('base64'), sign(COMPLETED_EVENT), {
      isBase64Encoded: true,
    }),
  )
  assert.equal(res.statusCode, 200)
})

test('valid signature over an unparseable payload is rejected as invalid_payload', async (t) => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  t.after(() => delete process.env.STRIPE_WEBHOOK_SECRET)
  const payload = 'not json {'
  const res = await handler(webhookEvent(payload, sign(payload)))
  assert.equal(res.statusCode, 400)
  assert.equal(JSON.parse(res.body).error, 'invalid_payload')
})

/* ----------------------------------------------- /webhook idempotency */

const loggedCompletion = (logs) =>
  logs.mock.calls.some((c) => String(c.arguments[0]).includes('member_checkout_completed'))

test('a replayed event id is de-duplicated and not reprocessed', async (t) => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  process.env.EVENTS_TABLE = 'events-test'
  t.after(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    delete process.env.EVENTS_TABLE
  })
  // The conditional PutItem fails: this event id was already written.
  t.mock.method(ddb, 'send', async () => {
    throw Object.assign(new Error('exists'), { name: 'ConditionalCheckFailedException' })
  })
  const logs = t.mock.method(console, 'log')
  const res = await handler(webhookEvent(COMPLETED_EVENT, sign(COMPLETED_EVENT)))
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { received: true, duplicate: true })
  assert.equal(loggedCompletion(logs), false, 'duplicate must not write a ledger line')
})

test('a first-delivery event is claimed and processed', async (t) => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  process.env.EVENTS_TABLE = 'events-test'
  t.after(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    delete process.env.EVENTS_TABLE
  })
  // The conditional PutItem succeeds: first time this id is seen.
  t.mock.method(ddb, 'send', async () => ({}))
  const logs = t.mock.method(console, 'log')
  const res = await handler(webhookEvent(COMPLETED_EVENT, sign(COMPLETED_EVENT)))
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { received: true })
  assert.equal(loggedCompletion(logs), true, 'first delivery writes the ledger line')
})

/* ------------------------------------- observability + durability tails */

test('a benign /session 404 does NOT log the alarmed stripe_error line', async (t) => {
  // Any well-formed session id probes this publicly — it must not page.
  t.mock.method(globalThis, 'fetch', async () => new Response(
    JSON.stringify({ error: { type: 'invalid_request_error', code: 'resource_missing' } }),
    { status: 404 },
  ))
  const errSpy = t.mock.method(console, 'error', () => {})
  const res = await handler(
    event({ method: 'GET', path: '/session', query: { session_id: `cs_test_${'a'.repeat(24)}` } }),
  )
  assert.equal(res.statusCode, 404)
  assert.equal(JSON.parse(res.body).error, 'not_found')
  assert.equal(errSpy.mock.calls.length, 0)
})

test('a real /session network failure logs the alarmed stripe_error line (was silent)', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('socket hang up')
  })
  const errSpy = t.mock.method(console, 'error', () => {})
  const res = await handler(
    event({ method: 'GET', path: '/session', query: { session_id: `cs_test_${'a'.repeat(24)}` } }),
  )
  assert.equal(res.statusCode, 502)
  const line = JSON.parse(errSpy.mock.calls[0].arguments[0])
  assert.equal(line.at, 'stripe_error')
  assert.equal(line.network, true)
})

test('all three webhook rejection paths log an alarmed webhook_rejected line (no payload content)', async (t) => {
  const errSpy = t.mock.method(console, 'error', () => {})
  // 1. not_configured (fail-closed 503)
  delete process.env.STRIPE_WEBHOOK_SECRET
  let res = await handler(webhookEvent(COMPLETED_EVENT, sign(COMPLETED_EVENT)))
  assert.equal(res.statusCode, 503)
  // 2. invalid_signature
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  t.after(() => delete process.env.STRIPE_WEBHOOK_SECRET)
  res = await handler(webhookEvent(COMPLETED_EVENT, sign(COMPLETED_EVENT, 'whsec_wrong')))
  assert.equal(res.statusCode, 400)
  // 3. invalid_payload (valid signature over garbage)
  const garbage = 'not json {'
  res = await handler(webhookEvent(garbage, sign(garbage)))
  assert.equal(res.statusCode, 400)

  const reasons = errSpy.mock.calls
    .map((c) => JSON.parse(c.arguments[0]))
    .filter((l) => l.at === 'webhook_rejected')
    .map((l) => l.reason)
  assert.deepEqual(reasons, ['not_configured', 'invalid_signature', 'invalid_payload'])
  // Never any payload content in the rejection lines
  for (const c of errSpy.mock.calls) {
    assert.doesNotMatch(String(c.arguments[0]), /not json/)
  }
})

test('a DynamoDB failure during the idempotency claim rethrows to 502 so Stripe retries', async (t) => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET
  process.env.EVENTS_TABLE = 'events-test'
  t.after(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    delete process.env.EVENTS_TABLE
  })
  t.mock.method(ddb, 'send', async () => {
    throw new Error('dynamodb unavailable')
  })
  const errSpy = t.mock.method(console, 'error', () => {})
  const res = await handler(webhookEvent(COMPLETED_EVENT, sign(COMPLETED_EVENT)))
  // A claim failure must NOT ack the event — the 502 makes Stripe retry.
  assert.equal(res.statusCode, 502)
  assert.equal(JSON.parse(res.body).error, 'upstream_error')
  const line = JSON.parse(errSpy.mock.calls[0].arguments[0])
  assert.equal(line.at, 'unhandled')
  assert.equal(line.route, '/webhook')
})

test('every metric-filter term in template.yaml exists in the handler source (drift guard)', async () => {
  const { readFile } = await import('node:fs/promises')
  const template = await readFile(new URL('../template.yaml', import.meta.url), 'utf8')
  const source = await readFile(new URL('../src/handler.mjs', import.meta.url), 'utf8')
  const patternLine = template.match(/FilterPattern: '(.+)'/)
  assert.ok(patternLine, 'FilterPattern not found in template.yaml')
  const terms = [...patternLine[1].matchAll(/\?"((?:[^"\\]|\\.)+)"/g)].map((m) =>
    m[1].replace(/\\"/g, '"'),
  )
  assert.ok(terms.length >= 3, `expected >=3 filter terms, got ${terms.length}`)
  for (const term of terms) {
    // The emitted JSON must contain each term literally once serialized;
    // check against the source's log tags (at:'x' serializes to "at":"x").
    const tag = term.replace(/^"at":"/, '').replace(/"$/, '')
    assert.ok(source.includes(tag), `filter term ${JSON.stringify(term)} has no source counterpart (${tag})`)
  }
})
