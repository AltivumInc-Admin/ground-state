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
  for (const group of chunk(recipients, BATCH_SIZE)) {
    const messages = buildBatch({ recipients: group, subject, html, text, fromName, fromAddress })
    const res = await fetchImpl(BATCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Postmark-Server-Token': token,
      },
      body: JSON.stringify(messages),
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
  }
  return { sent, failed }
}
