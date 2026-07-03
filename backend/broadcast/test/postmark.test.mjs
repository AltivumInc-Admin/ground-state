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
  assert.equal(msgs[0].HtmlBody, 'H')
  assert.equal(msgs[0].TextBody, 'T')
  assert.equal(msgs[0].TrackOpens, true)
  assert.equal(msgs[0].TrackLinks, 'None')
})

test('sendIssue posts batches and collects per-recipient failures', async () => {
  const calls = []
  const fetchImpl = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body), headers: opts.headers })
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
  assert.equal(calls[0].headers['X-Postmark-Server-Token'], 'tok')
  assert.equal(res.sent, 1)
  assert.deepEqual(res.failed, [{ email: 'c@d.com', code: 406, message: 'Inactive recipient' }])
})

test('a non-ok Postmark status aborts WITH the tally preserved (not a bare throw)', async (t) => {
  t.mock.method(console, 'log', () => {})
  const fetchImpl = async () => ({ ok: false, status: 422, text: async () => 'bad' })
  const res = await sendIssue({
    recipients: ['a@b.com'], subject: 'S', html: 'H', text: 'T',
    fromName: 'GSS', fromAddress: 'no-reply@gss.com', token: 'tok', fetchImpl,
  })
  assert.equal(res.sent, 0)
  assert.deepEqual(res.failed, [])
  assert.equal(res.aborted.atBatch, 1)
  assert.equal(res.aborted.remaining, 1)
  assert.match(res.aborted.message, /postmark_batch_failed 422/)
})

test('a bounded-fetch timeout aborts with the tally, never an infinite hang', async (t) => {
  t.mock.method(console, 'log', () => {})
  const fetchImpl = async () => {
    throw Object.assign(new Error('The operation was aborted due to timeout'), {
      name: 'TimeoutError',
    })
  }
  const res = await sendIssue({
    recipients: ['a@b.com'], subject: 'S', html: 'H', text: 'T',
    fromName: 'GSS', fromAddress: 'no-reply@gss.com', token: 'tok', fetchImpl,
  })
  assert.equal(res.sent, 0)
  assert.match(res.aborted.message, /timeout/)
})

test('a mid-run batch failure keeps the delivered tally and counts the remainder', async (t) => {
  t.mock.method(console, 'log', () => {})
  // 501 recipients = two batches (500 + 1); batch 1 succeeds, batch 2 fails.
  const recipients = Array.from({ length: 501 }, (_, i) => `r${i}@x.co`)
  let call = 0
  const fetchImpl = async () => {
    call += 1
    if (call === 1) {
      return {
        ok: true,
        json: async () => recipients.slice(0, 500).map((To) => ({ ErrorCode: 0, Message: 'OK', To })),
      }
    }
    return { ok: false, status: 503, text: async () => 'down' }
  }
  const res = await sendIssue({
    recipients, subject: 'S', html: 'H', text: 'T',
    fromName: 'GSS', fromAddress: 'no-reply@gss.com', token: 'tok', fetchImpl,
  })
  assert.equal(res.sent, 500) // batches before the failure are NOT discarded
  assert.equal(res.aborted.atBatch, 2)
  assert.equal(res.aborted.remaining, 1)
})

test('per-batch progress lines are printed (index, size, running tally)', async (t) => {
  const logSpy = t.mock.method(console, 'log', () => {})
  const fetchImpl = async () => ({ ok: true, json: async () => [{ ErrorCode: 0, Message: 'OK', To: 'a@b.com' }] })
  await sendIssue({
    recipients: ['a@b.com'], subject: 'S', html: 'H', text: 'T',
    fromName: 'GSS', fromAddress: 'no-reply@gss.com', token: 'tok', fetchImpl,
  })
  const line = JSON.parse(logSpy.mock.calls[0].arguments[0])
  assert.equal(line.at, 'batch')
  assert.equal(line.index, 1)
  assert.equal(line.of, 1)
  assert.equal(line.size, 1)
  assert.equal(line.sentSoFar, 0)
})
