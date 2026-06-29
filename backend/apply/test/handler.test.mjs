import { test } from 'node:test'
import assert from 'node:assert/strict'

// Set before importing the handler so the Secrets Manager cold-start fetch never
// fires (env wins) — keeps the suite offline.
process.env.POSTMARK_TOKEN = 'pm-test-token'
process.env.FROM_ADDRESS = 'no-reply@groundstatesociety.com'
process.env.OPERATOR_EMAIL = 'operator@groundstatesociety.com'

const { makeHandler } = await import('../src/handler.mjs')

const event = ({ method = 'POST', path = '/apply', body, headers = {} } = {}) => ({
  rawPath: path,
  requestContext: { http: { method, sourceIp: '9.9.9.9' } },
  headers,
  body: typeof body === 'string' || body === undefined ? body : JSON.stringify(body),
})

const VALID = {
  form: 'apply',
  name: 'Ada Quantum',
  email: 'Ada@Qubit.co',
  company: 'QubitCo',
  role: 'Co-founder & CEO',
  applicantType: 'Founder',
  stage: 'Seed',
  modality: 'Quantum software',
  want: 'Peers who get it.',
  website: '',
}

function fakes(overrides = {}) {
  const calls = { stored: [], notified: [] }
  const store = {
    async putApplication(a) {
      calls.stored.push(a)
      return { id: 'app-id' }
    },
    ...overrides.store,
  }
  const email = {
    async notifyOperator(a) {
      calls.notified.push(a)
    },
    ...overrides.email,
  }
  return { handler: makeHandler({ store, email }), calls }
}

test('valid application is stored (email normalized) and the operator is notified, generic 200', async () => {
  const { handler, calls } = fakes()
  const res = await handler(event({ body: VALID }))
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { ok: true })
  assert.equal(calls.stored.length, 1)
  assert.equal(calls.stored[0].email, 'ada@qubit.co') // trimmed + lowercased
  assert.equal(calls.stored[0].company, 'QubitCo')
  assert.equal(calls.stored[0].consentIp, '9.9.9.9')
  assert.equal(calls.stored[0].website, undefined) // honeypot never persisted
  assert.equal(calls.notified.length, 1)
  assert.equal(calls.notified[0].application.email, 'ada@qubit.co')
})

test('honeypot filled returns 200 but stores/notifies nothing', async () => {
  const { handler, calls } = fakes()
  const res = await handler(event({ body: { ...VALID, website: 'spam' } }))
  assert.equal(res.statusCode, 200)
  assert.equal(calls.stored.length, 0)
  assert.equal(calls.notified.length, 0)
})

test('invalid email returns 400 invalid_email and stores nothing', async () => {
  const { handler, calls } = fakes()
  const res = await handler(event({ body: { ...VALID, email: 'nope' } }))
  assert.equal(res.statusCode, 400)
  assert.deepEqual(JSON.parse(res.body), { error: 'invalid_email' })
  assert.equal(calls.stored.length, 0)
})

test('a missing required field returns 400 invalid_application', async () => {
  const { handler } = fakes()
  const { company: _company, ...missing } = VALID
  const res = await handler(event({ body: missing }))
  assert.equal(res.statusCode, 400)
  assert.deepEqual(JSON.parse(res.body), { error: 'invalid_application' })
})

test('an oversized field returns 400 invalid_application', async () => {
  const { handler } = fakes()
  const res = await handler(event({ body: { ...VALID, want: 'x'.repeat(2001) } }))
  assert.equal(res.statusCode, 400)
  assert.deepEqual(JSON.parse(res.body), { error: 'invalid_application' })
})

test('malformed JSON body returns 400 invalid_json', async () => {
  const { handler } = fakes()
  const res = await handler(event({ body: 'not-json' }))
  assert.equal(res.statusCode, 400)
  assert.deepEqual(JSON.parse(res.body), { error: 'invalid_json' })
})

test('unknown route returns 404', async () => {
  const { handler } = fakes()
  assert.equal((await handler(event({ path: '/nope' }))).statusCode, 404)
})

test('a failed operator notification still returns 200 (record is the source of truth)', async () => {
  const { handler, calls } = fakes({
    email: { async notifyOperator() { throw new Error('postmark_send_failed 422') } },
  })
  const res = await handler(event({ body: VALID }))
  assert.equal(res.statusCode, 200)
  assert.equal(calls.stored.length, 1) // stored before the notify attempt
})

test('a failed persist returns 502 (unhandled) and does not 200', async () => {
  const { handler, calls } = fakes({
    store: { async putApplication() { throw new Error('ddb down') } },
  })
  const res = await handler(event({ body: VALID }))
  assert.equal(res.statusCode, 502)
  assert.deepEqual(JSON.parse(res.body), { error: 'upstream_error' })
  assert.equal(calls.notified.length, 0) // never reached notify
})
