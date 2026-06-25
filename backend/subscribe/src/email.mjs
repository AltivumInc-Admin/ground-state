// Transactional sender — Postmark via its HTTPS Email API (no SDK; Node 22 global
// fetch keeps the function dependency-light). The magic link always goes on the
// 'outbound' (transactional) Message Stream so a future 'Signal' broadcast stream
// can never share its reputation. POSTMARK_TOKEN is the Server API Token, fetched
// from Secrets Manager at cold start (see handler.mjs) — never a plaintext env var.
const POSTMARK_API = 'https://api.postmarkapp.com/email'
const STREAM = 'outbound'
const FROM_NAME = 'The Ground State Society'
// Optional postal address rendered in the footer — a real mailing address is a
// strong legitimacy/deliverability signal. Set it to enable that line.
const POSTAL_ADDRESS = ''

// Source-specific confirmation copy. Signal subscribers confirm on the ground-state site and get
// the free briefing; quantum-intro subscribers confirm on the module and get the learning content.
// The token lifetime (TOKEN_TTL_SEC in store.mjs) is 15 minutes for both.
const COPY = {
  signal: {
    subject: 'Confirm your subscription to The Signal',
    preheader: 'One click confirms your email and starts The Signal.',
    intro:
      'Someone entered this address to receive The Signal — the free briefing for quantum builders from The Ground State Society. Confirm below to start receiving it.',
    cta: 'Confirm subscription',
  },
  'quantum-intro': {
    subject: 'Confirm your access to the Quantum Intro',
    preheader: 'One click confirms your email and opens the free course.',
    intro:
      'Someone entered this address to open the free Introduction to Quantum Computing. Confirm below to start learning.',
    cta: 'Confirm and start learning',
  },
}

const HEADING = 'Confirm your email address'
const EXPIRY = 'For your security, this link expires in 15 minutes and can be used once.'
const WHY =
  'You received this because this address was entered at groundstatesociety.com. If that was not you, ignore this email — no account is created and nothing happens.'
const ENTITY = `The Ground State Society · operated by Altivum Inc.${POSTAL_ADDRESS ? ` · ${POSTAL_ADDRESS}` : ''}`

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export function buildMagicLinkEmail({ link, source }) {
  // The handler only calls this with a validated source; fall back rather than throw if that ever changes.
  const copy = COPY[source] ?? COPY.signal

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f7ff;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f7f7ff;">${copy.preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7ff;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e6e6ef;border-radius:10px;">
        <tr><td style="padding:28px 32px 0;">
          <p style="margin:0;font:600 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;color:#432d16;">The Ground State Society</p>
        </td></tr>
        <tr><td style="padding:18px 32px 0;">
          <h1 style="margin:0 0 12px;font:700 22px/1.3 ${FONT};color:#08080a;">${HEADING}</h1>
          <p style="margin:0 0 22px;font:400 15px/1.6 ${FONT};color:#432d16;">${copy.intro}</p>
        </td></tr>
        <tr><td style="padding:0 32px;">
          <a href="${link}" style="display:inline-block;background:#08080a;color:#f7f7ff;text-decoration:none;font:600 15px/1 ${FONT};padding:14px 28px;border-radius:6px;">${copy.cta}</a>
        </td></tr>
        <tr><td style="padding:22px 32px 0;">
          <p style="margin:0 0 4px;font:400 13px/1.5 ${FONT};color:#6b6b76;">Or paste this link into your browser:</p>
          <p style="margin:0;font:400 12px/1.5 ui-monospace,monospace;color:#4a6878;word-break:break-all;">${link}</p>
        </td></tr>
        <tr><td style="padding:20px 32px 24px;">
          <p style="margin:0;font:400 13px/1.5 ${FONT};color:#6b6b76;">${EXPIRY}</p>
        </td></tr>
        <tr><td style="padding:0 32px;"><hr style="border:0;border-top:1px solid #e6e6ef;margin:0;"></td></tr>
        <tr><td style="padding:18px 32px 28px;">
          <p style="margin:0 0 6px;font:400 12px/1.6 ${FONT};color:#9a9aa6;">${WHY}</p>
          <p style="margin:0;font:400 12px/1.6 ${FONT};color:#9a9aa6;">${ENTITY}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const text = `THE GROUND STATE SOCIETY

${HEADING}

${copy.intro}

Confirm: ${link}

${EXPIRY}

—
${WHY}
${ENTITY}`

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
      From: `${FROM_NAME} <${process.env.FROM_ADDRESS}>`,
      To: to,
      Subject: subject,
      HtmlBody: html,
      TextBody: text,
      MessageStream: STREAM,
      // Magic links must NOT be rewritten through Postmark's tracking-redirect
      // domain — it hurts deliverability and proxies a security-sensitive link.
      // No open pixel either; this is transactional, not marketing.
      TrackOpens: false,
      TrackLinks: 'None',
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
