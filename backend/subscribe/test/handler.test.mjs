import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.SIGNAL_VERIFY_URL = 'https://groundstatesociety.com/confirm'
process.env.QUANTUM_VERIFY_URL = 'https://quantum.altivum.ai/verify'
process.env.TOKEN_PEPPER = 'pepper_test'
process.env.SESSION_SECRET = 'session_test'
process.env.SESSION_TTL_SEC = '2592000'
process.env.POSTMARK_WEBHOOK_SECRET = 'whsecret'

const { makeHandler } = await import('../src/handler.mjs')

const basicAuth = (user, pass) =>
  `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
const WEBHOOK_AUTH = { authorization: basicAuth('postmark', 'whsecret') }

const event = ({ method = 'POST', path = '/subscribe', body, headers = {} } = {}) => ({
  rawPath: path,
  requestContext: { http: { method, sourceIp: '9.9.9.9' } },
  headers,
  body: typeof body === 'string' || body === undefined ? body : JSON.stringify(body),
})

function fakes() {
  const calls = { created: [], sent: [], consumed: [], confirmed: [], suppressed: [] }
  const store = {
    async createPending(a) { calls.created.push(a); return { alreadyConfirmed: false } },
    async consumeToken(h) { calls.consumed.push(h); return { email: 'a@b.co' } },
    async confirm(e) { calls.confirmed.push(e); return true },
    async suppress(a) { calls.suppressed.push(a) },
  }
  const email = { async sendMagicLink(a) { calls.sent.push(a) } }
  return { handler: makeHandler({ store, email }), calls }
}

test('valid subscribe stores pending and sends a link, generic 200', async () => {
  const { handler, calls } = fakes()
  const res = await handler(event({ body: { email: 'a@b.co', source: 'signal' } }))
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { ok: true })
  assert.equal(calls.created.length, 1)
  assert.equal(calls.created[0].source, 'signal')
  assert.equal(calls.created[0].consentIp, '9.9.9.9')
  assert.equal(calls.sent.length, 1)
  // signal source -> the ground-state /confirm landing page + Signal-specific copy
  assert.match(calls.sent[0].link, /^https:\/\/groundstatesociety\.com\/confirm\?token=/)
  assert.equal(calls.sent[0].source, 'signal')
})

test('quantum-intro subscribe links to the module verify page', async () => {
  const { handler, calls } = fakes()
  const res = await handler(event({ body: { email: 'a@b.co', source: 'quantum-intro' } }))
  assert.equal(res.statusCode, 200)
  assert.match(calls.sent[0].link, /^https:\/\/quantum\.altivum\.ai\/verify\?token=/)
  assert.equal(calls.sent[0].source, 'quantum-intro')
})

test('honeypot filled returns 200 but stores/sends nothing', async () => {
  const { handler, calls } = fakes()
  const res = await handler(event({ body: { email: 'a@b.co', source: 'signal', website: 'spam' } }))
  assert.equal(res.statusCode, 200)
  assert.equal(calls.created.length, 0)
  assert.equal(calls.sent.length, 0)
})

test('invalid email returns 400', async () => {
  const { handler } = fakes()
  const res = await handler(event({ body: { email: 'nope', source: 'signal' } }))
  assert.equal(res.statusCode, 400)
  assert.deepEqual(JSON.parse(res.body), { error: 'invalid_email' })
})

test('invalid source returns 400', async () => {
  const { handler } = fakes()
  const res = await handler(event({ body: { email: 'a@b.co', source: 'evil' } }))
  assert.equal(res.statusCode, 400)
  assert.deepEqual(JSON.parse(res.body), { error: 'invalid_source' })
})

test('already-confirmed email still returns generic 200 without sending', async () => {
  const { calls } = fakes()
  const store = {
    async createPending() { return { alreadyConfirmed: true } },
    async consumeToken() {}, async confirm() {},
  }
  const handler = makeHandler({ store, email: { async sendMagicLink(a) { calls.sent.push(a) } } })
  const res = await handler(event({ body: { email: 'a@b.co', source: 'signal' } }))
  assert.equal(res.statusCode, 200)
  assert.equal(calls.sent.length, 0)
})

test('unknown route returns 404', async () => {
  const { handler } = fakes()
  assert.equal((await handler(event({ path: '/nope' }))).statusCode, 404)
})

test('verify consumes the token, confirms, and returns a bearer token in the body', async () => {
  const { handler } = fakes()
  const res = await handler(event({ path: '/verify', body: { token: 'XYZ' } }))
  assert.equal(res.statusCode, 200)
  assert.equal(res.cookies, undefined) // cross-site: bearer token, not a cookie
  const b = JSON.parse(res.body)
  assert.equal(b.ok, true)
  assert.match(b.token, /^[A-Za-z0-9_-]+\.[0-9a-f]{64}$/) // signSession: base64url(payload).hex(sig)
})

test('verify with a dead token returns 400 and no cookie', async () => {
  const store = {
    async createPending() { return { alreadyConfirmed: false } },
    async consumeToken() { return null },
    async confirm() { return false },
  }
  const handler = makeHandler({ store, email: { async sendMagicLink() {} } })
  const res = await handler(event({ path: '/verify', body: { token: 'dead' } }))
  assert.equal(res.statusCode, 400)
  assert.equal(res.cookies, undefined)
})

test('verify missing token returns 400', async () => {
  const { handler } = fakes()
  assert.equal((await handler(event({ path: '/verify', body: {} }))).statusCode, 400)
})

test('malformed JSON body returns 400 invalid_json', async () => {
  const { handler } = fakes()
  const res = await handler(event({ body: 'not-json' }))
  assert.equal(res.statusCode, 400)
  assert.deepEqual(JSON.parse(res.body), { error: 'invalid_json' })
})

test('postmark-webhook rejects missing or wrong Basic auth with 401', async () => {
  const { handler, calls } = fakes()
  const body = { RecordType: 'SpamComplaint', Email: 'a@b.co' }
  const noAuth = await handler(event({ path: '/postmark-webhook', body }))
  assert.equal(noAuth.statusCode, 401)
  const badAuth = await handler(
    event({ path: '/postmark-webhook', headers: { authorization: basicAuth('postmark', 'wrong') }, body }),
  )
  assert.equal(badAuth.statusCode, 401)
  assert.equal(calls.suppressed.length, 0)
})

test('postmark-webhook suppresses on a spam complaint (email normalized)', async () => {
  const { handler, calls } = fakes()
  const res = await handler(
    event({ path: '/postmark-webhook', headers: WEBHOOK_AUTH, body: { RecordType: 'SpamComplaint', Email: 'A@B.co' } }),
  )
  assert.equal(res.statusCode, 200)
  assert.equal(calls.suppressed.length, 1)
  assert.equal(calls.suppressed[0].email, 'a@b.co')
  assert.equal(calls.suppressed[0].reason, 'complaint')
  assert.equal(calls.suppressed[0].recordType, 'SpamComplaint')
})

test('postmark-webhook suppresses on a hard bounce', async () => {
  const { handler, calls } = fakes()
  const res = await handler(
    event({ path: '/postmark-webhook', headers: WEBHOOK_AUTH, body: { RecordType: 'Bounce', Type: 'HardBounce', Inactive: true, Email: 'x@y.co' } }),
  )
  assert.equal(res.statusCode, 200)
  assert.equal(calls.suppressed[0].reason, 'bounce')
})

test('postmark-webhook acknowledges but does not suppress transient/other events', async () => {
  const { handler, calls } = fakes()
  const soft = await handler(
    event({ path: '/postmark-webhook', headers: WEBHOOK_AUTH, body: { RecordType: 'Bounce', Type: 'SoftBounce', Inactive: false, Email: 'x@y.co' } }),
  )
  assert.equal(soft.statusCode, 200)
  const delivery = await handler(
    event({ path: '/postmark-webhook', headers: WEBHOOK_AUTH, body: { RecordType: 'Delivery', Email: 'x@y.co' } }),
  )
  assert.equal(delivery.statusCode, 200)
  assert.equal(calls.suppressed.length, 0)
})
