import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.FROM_ADDRESS = 'no-reply@groundstatesociety.com'
process.env.POSTMARK_TOKEN = 'pm-test-token'

const { sendMagicLink, buildMagicLinkEmail } = await import('../src/email.mjs')

const realFetch = globalThis.fetch
const withFetch = async (impl, fn) => {
  globalThis.fetch = impl
  try {
    return await fn()
  } finally {
    globalThis.fetch = realFetch
  }
}

test('signal copy speaks to The Signal, not the Quantum Intro', () => {
  const { subject, html, text } = buildMagicLinkEmail({
    link: 'https://groundstatesociety.com/confirm?token=ABC',
    source: 'signal',
  })
  assert.match(subject, /Signal/)
  assert.doesNotMatch(subject, /Quantum Intro/)
  assert.match(html, /The Signal/)
  assert.doesNotMatch(html, /Introduction to Quantum Computing/)
  assert.match(html, /groundstatesociety\.com\/confirm\?token=ABC/)
  assert.match(text, /groundstatesociety\.com\/confirm\?token=ABC/)
})

test('quantum-intro copy speaks to the module', () => {
  const { subject, html, text } = buildMagicLinkEmail({
    link: 'https://quantum.altivum.ai/verify?token=XYZ',
    source: 'quantum-intro',
  })
  assert.match(subject, /Quantum Intro/)
  assert.match(html, /Introduction to Quantum Computing/)
  assert.doesNotMatch(html, /The Signal/)
  assert.match(html, /quantum\.altivum\.ai\/verify\?token=XYZ/)
  assert.match(text, /quantum\.altivum\.ai\/verify\?token=XYZ/)
})

test('both variants carry the 15-minute expiry note and no emoji', () => {
  for (const source of ['signal', 'quantum-intro']) {
    const { subject, html, text } = buildMagicLinkEmail({ link: 'https://x/confirm?token=T', source })
    assert.match(html, /expires in 15 minutes/)
    assert.match(text, /expires in 15 minutes/)
    assert.doesNotMatch(`${subject}${html}${text}`, /[\u{1F300}-\u{1FAFF}]/u)
  }
})

test('unknown source falls back to Signal copy rather than throwing', () => {
  const { subject } = buildMagicLinkEmail({ link: 'https://x/confirm?token=T', source: undefined })
  assert.match(subject, /Signal/)
})

test('sendMagicLink POSTs to Postmark with the token, From, and the outbound stream', async () => {
  let url, opts
  await withFetch(
    async (u, o) => {
      url = u
      opts = o
      return { ok: true, status: 200, text: async () => '' }
    },
    () =>
      sendMagicLink({
        to: 'a@b.co',
        link: 'https://groundstatesociety.com/confirm?token=XYZ',
        source: 'signal',
      }),
  )
  assert.equal(url, 'https://api.postmarkapp.com/email')
  assert.equal(opts.method, 'POST')
  assert.equal(opts.headers['X-Postmark-Server-Token'], 'pm-test-token')
  const body = JSON.parse(opts.body)
  assert.equal(body.From, 'The Ground State Society <no-reply@groundstatesociety.com>')
  assert.equal(body.To, 'a@b.co')
  assert.equal(body.MessageStream, 'outbound')
  // Magic link must not be proxied/tracked: no link rewrite, no open pixel.
  assert.equal(body.TrackLinks, 'None')
  assert.equal(body.TrackOpens, false)
  assert.match(body.Subject, /Signal/)
  assert.match(body.HtmlBody, /groundstatesociety\.com\/confirm\?token=XYZ/)
  assert.match(body.TextBody, /groundstatesociety\.com\/confirm\?token=XYZ/)
  assert.doesNotMatch(body.Subject, /[\u{1F300}-\u{1FAFF}]/u) // no emoji
})

test('sendMagicLink throws on a non-2xx Postmark response (handler maps it to 502)', async () => {
  await withFetch(
    async () => ({ ok: false, status: 422, text: async () => '{"ErrorCode":406,"Message":"Inactive recipient"}' }),
    () =>
      assert.rejects(
        () => sendMagicLink({ to: 'x@y.co', link: 'https://x/confirm?token=T', source: 'signal' }),
        /postmark_send_failed 422/,
      ),
  )
})
