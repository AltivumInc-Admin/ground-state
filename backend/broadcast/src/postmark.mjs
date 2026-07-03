import { chunk } from './chunk.mjs'

const BATCH_URL = 'https://api.postmarkapp.com/email/batch'
const STREAM = 'broadcast'
const BATCH_SIZE = 500 // Postmark hard cap per /email/batch request

export function buildBatch({ recipients, subject, html, text, fromName, fromAddress }) {
  return recipients.map((to) => ({
    From: `${fromName} <${fromAddress}>`,
    To: to,
    Subject: subject,
    HtmlBody: html,
    TextBody: text,
    MessageStream: STREAM,
    // Open tracking is fine for a newsletter; leave link tracking off so URLs
    // are not rewritten through Postmark's redirect domain.
    TrackOpens: true,
    TrackLinks: 'None',
  }))
}

export async function sendIssue({ recipients, subject, html, text, fromName, fromAddress, token, fetchImpl = fetch }) {
  let sent = 0
  const failed = []
  const groups = chunk(recipients, BATCH_SIZE)
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]
    // Per-batch progress: on a long send the operator must see movement, and
    // on a failure the last line printed IS the state of the run.
    console.log(
      JSON.stringify({ at: 'batch', index: i + 1, of: groups.length, size: group.length, sentSoFar: sent }),
    )
    const messages = buildBatch({ recipients: group, subject, html, text, fromName, fromAddress })
    try {
      const res = await fetchImpl(BATCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Postmark-Server-Token': token,
        },
        body: JSON.stringify(messages),
        // Generous for a 500-message batch, but bounded — a hung Postmark fails
        // through the aborted-tally path instead of hanging the operator's
        // send-day terminal indefinitely.
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`postmark_batch_failed ${res.status}: ${detail}`)
      }
      const results = await res.json()
      for (const r of results) {
        if (r.ErrorCode === 0) sent += 1
        else failed.push({ email: r.To, code: r.ErrorCode, message: r.Message })
      }
    } catch (err) {
      // Preserve the tally instead of throwing it away: batches 1..i-1 WERE
      // delivered. The operator's resume decision needs exactly what was
      // confirmed and how many remain — including this batch, whose delivery
      // state is unknown.
      const remaining = groups.slice(i).reduce((n, g) => n + g.length, 0)
      return { sent, failed, aborted: { atBatch: i + 1, remaining, message: err?.message } }
    }
  }
  return { sent, failed }
}
