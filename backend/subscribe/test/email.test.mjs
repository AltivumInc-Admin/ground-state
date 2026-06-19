import { test, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { SendEmailCommand } from '@aws-sdk/client-sesv2'

process.env.FROM_ADDRESS = 'no-reply@altivum.ai'
process.env.CONFIG_SET = 'gss-subscribe'

const { ses, sendMagicLink } = await import('../src/email.mjs')

beforeEach(() => mock.restoreAll())

test('sendMagicLink issues a SES v2 SendEmail with html+text and the config set', async () => {
  let cmd
  mock.method(ses, 'send', async (c) => { cmd = c; return { MessageId: 'm1' } })
  await sendMagicLink({ to: 'a@b.co', link: 'https://quantum.altivum.ai/verify?token=XYZ' })
  assert.ok(cmd instanceof SendEmailCommand)
  const i = cmd.input
  assert.equal(i.FromEmailAddress, 'no-reply@altivum.ai')
  assert.deepEqual(i.Destination.ToAddresses, ['a@b.co'])
  assert.equal(i.ConfigurationSetName, 'gss-subscribe')
  assert.match(i.Content.Simple.Body.Html.Data, /quantum\.altivum\.ai\/verify\?token=XYZ/)
  assert.match(i.Content.Simple.Body.Text.Data, /quantum\.altivum\.ai\/verify\?token=XYZ/)
  assert.doesNotMatch(i.Content.Simple.Subject.Data, /[\u{1F300}-\u{1FAFF}]/u) // no emoji
})
