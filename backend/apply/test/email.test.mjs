import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.FROM_ADDRESS = 'no-reply@groundstatesociety.com'
process.env.OPERATOR_EMAIL = 'operator@groundstatesociety.com'
process.env.POSTMARK_TOKEN = 'pm-test-token'

const { notifyOperator, buildApplicationEmail } = await import('../src/email.mjs')

const realFetch = globalThis.fetch
const withFetch = async (impl, fn) => {
  globalThis.fetch = impl
  try {
    return await fn()
  } finally {
    globalThis.fetch = realFetch
  }
}

const APP = {
  name: 'Ada Quantum',
  email: 'ada@qubit.co',
  company: 'QubitCo',
  role: 'Co-founder & CEO',
  applicantType: 'Founder',
  stage: 'Seed',
  modality: 'Quantum software',
  want: 'Peers who get it.',
}

test('buildApplicationEmail summarizes the application in subject + bodies, no emoji', () => {
  const { subject, html, text } = buildApplicationEmail({ application: APP })
  assert.match(subject, /QubitCo/)
  assert.match(subject, /Ada Quantum/)
  for (const v of ['Ada Quantum', 'ada@qubit.co', 'QubitCo', 'Seed', 'Quantum software', 'Peers who get it.']) {
    assert.match(html, new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(text, new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.doesNotMatch(`${subject}${html}${text}`, /[\u{1F300}-\u{1FAFF}]/u)
})

test('buildApplicationEmail HTML-escapes field values (no injection)', () => {
  const { html } = buildApplicationEmail({
    application: { ...APP, company: 'Qubit <script>&"co"' },
  })
  assert.match(html, /Qubit &lt;script&gt;&amp;/)
  assert.doesNotMatch(html, /<script>/)
})

test('notifyOperator POSTs to Postmark: token, From, To=operator, ReplyTo=applicant, outbound, no tracking', async () => {
  let url, opts
  await withFetch(
    async (u, o) => { url = u; opts = o; return { ok: true, status: 200, text: async () => '' } },
    () => notifyOperator({ application: APP }),
  )
  assert.equal(url, 'https://api.postmarkapp.com/email')
  assert.equal(opts.method, 'POST')
  assert.equal(opts.headers['X-Postmark-Server-Token'], 'pm-test-token')
  const body = JSON.parse(opts.body)
  assert.equal(body.From, 'The Ground State Society <no-reply@groundstatesociety.com>')
  assert.equal(body.To, 'operator@groundstatesociety.com')
  assert.equal(body.ReplyTo, 'ada@qubit.co')
  assert.equal(body.MessageStream, 'outbound')
  assert.equal(body.TrackLinks, 'None')
  assert.equal(body.TrackOpens, false)
  assert.match(body.Subject, /QubitCo/)
})

test('notifyOperator throws on a non-2xx Postmark response (handler logs notify_failed)', async () => {
  await withFetch(
    async () => ({ ok: false, status: 422, text: async () => '{"ErrorCode":406}' }),
    () => assert.rejects(() => notifyOperator({ application: APP }), /postmark_send_failed 422/),
  )
})
