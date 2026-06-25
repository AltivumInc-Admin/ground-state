// Transactional sender — Postmark via its HTTPS Email API (no SDK; Node 22 global
// fetch keeps the function dependency-light). The magic link always goes on the
// 'outbound' (transactional) Message Stream so a future 'Signal' broadcast stream
// can never share its reputation. POSTMARK_TOKEN is the Server API Token, fetched
// from Secrets Manager at cold start (see handler.mjs) — never a plaintext env var.
const POSTMARK_API = 'https://api.postmarkapp.com/email'
const STREAM = 'outbound'

// Source-specific confirmation copy. Signal subscribers confirm on the ground-state site and get
// the free briefing; quantum-intro subscribers confirm on the module and get the learning content.
// The token lifetime (TOKEN_TTL_SEC in store.mjs) is 15 minutes for both.
const COPY = {
  signal: {
    subject: 'Confirm your subscription to The Signal',
    intro: 'Confirm your email to start receiving The Signal — the free briefing for quantum builders.',
    cta: 'Confirm subscription',
  },
  'quantum-intro': {
    subject: 'Confirm your free access to the Quantum Intro',
    intro: 'Confirm your email to open the free Introduction to Quantum Computing.',
    cta: 'Confirm and start learning',
  },
}

const EXPIRY = "This link expires in 15 minutes. If you didn't request it, ignore this email."

export function buildMagicLinkEmail({ link, source }) {
  // The handler only calls this with a validated source; fall back rather than throw if that ever changes.
  const copy = COPY[source] ?? COPY.signal
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1a1a1a">
    <p>${copy.intro}</p>
    <p><a href="${link}">${copy.cta}</a></p>
    <p style="color:#666;font-size:14px">${EXPIRY}</p>
  </body></html>`
  const text = `${copy.intro}\n\n${link}\n\n${EXPIRY}`
  return { subject: copy.subject, html, text }
}

export async function sendMagicLink({ to, link, source }) {
  const { subject, html, text } = buildMagicLinkEmail({ link, source })
  const res = await fetch(POSTMARK_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Postmark-Server-Token': process.env.POSTMARK_TOKEN,
    },
    body: JSON.stringify({
      From: process.env.FROM_ADDRESS,
      To: to,
      Subject: subject,
      HtmlBody: html,
      TextBody: text,
      MessageStream: STREAM,
    }),
  })
  // Postmark returns 200 only on accept; anything else (422 inactive-recipient,
  // 401 bad token, 5xx) is a failure. Surface the detail server-side; the handler
  // funnels any throw to a generic 502.
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`postmark_send_failed ${res.status}: ${detail}`)
  }
}
