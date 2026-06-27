import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildBatch, sendIssue } from '../src/postmark.mjs'

test('buildBatch creates one broadcast message per recipient', () => {
  const msgs = buildBatch({ recipients: ['a@b.com', 'c@d.com'], subject: 'S', html: 'H', text: 'T', fromName: 'GSS', fromAddress: 'no-reply@gss.com' })
  assert.equal(msgs.length, 2)
  assert.equal(msgs[0].To, 'a@b.com')
  assert.equal(msgs[0].From, 'GSS <no-reply@gss.com>')
  assert.equal(msgs[0].MessageStream, 'broadcast')
  assert.equal(msgs[0].Subject, 'S')
})

test('sendIssue posts batches and collects per-recipient failures', async () => {
  const calls = []
  const fetchImpl = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) })
    // Postmark /email/batch returns an array of per-message results
    return { ok: true, json: async () => [
      { ErrorCode: 0, Message: 'OK', To: 'a@b.com' },
      { ErrorCode: 406, Message: 'Inactive recipient', To: 'c@d.com' },
    ] }
  }
  const res = await sendIssue({
    recipients: ['a@b.com', 'c@d.com'], subject: 'S', html: 'H', text: 'T',
    fromName: 'GSS', fromAddress: 'no-reply@gss.com', token: 'tok', fetchImpl,
  })
  assert.equal(calls[0].url, 'https://api.postmarkapp.com/email/batch')
  assert.equal(res.sent, 1)
  assert.deepEqual(res.failed, [{ email: 'c@d.com', code: 406, message: 'Inactive recipient' }])
})
