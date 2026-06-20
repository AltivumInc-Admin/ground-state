import { test, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { SendEmailCommand } from '@aws-sdk/client-sesv2'

process.env.FROM_ADDRESS = 'no-reply@altivum.ai'
process.env.CONFIG_SET = 'gss-subscribe'

const { ses, sendMagicLink, buildMagicLinkEmail } = await import('../src/email.mjs')

beforeEach(() => mock.restoreAll())

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

test('sendMagicLink issues a SES v2 SendEmail with the source subject and config set', async () => {
  let cmd
  mock.method(ses, 'send', async (c) => {
    cmd = c
    return { MessageId: 'm1' }
  })
  await sendMagicLink({
    to: 'a@b.co',
    link: 'https://groundstatesociety.com/confirm?token=XYZ',
    source: 'signal',
  })
  assert.ok(cmd instanceof SendEmailCommand)
  const i = cmd.input
  assert.equal(i.FromEmailAddress, 'no-reply@altivum.ai')
  assert.deepEqual(i.Destination.ToAddresses, ['a@b.co'])
  assert.equal(i.ConfigurationSetName, 'gss-subscribe')
  assert.match(i.Content.Simple.Subject.Data, /Signal/)
  assert.match(i.Content.Simple.Body.Html.Data, /groundstatesociety\.com\/confirm\?token=XYZ/)
  assert.match(i.Content.Simple.Body.Text.Data, /groundstatesociety\.com\/confirm\?token=XYZ/)
  assert.doesNotMatch(i.Content.Simple.Subject.Data, /[\u{1F300}-\u{1FAFF}]/u) // no emoji
})
