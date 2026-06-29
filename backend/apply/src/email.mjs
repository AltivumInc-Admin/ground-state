// Operator notification — Postmark via its HTTPS Email API (no SDK; Node 22
// global fetch keeps the function dependency-light). Mirrors the subscribe
// sender exactly in transport shape: the 'outbound' transactional Message
// Stream, no link/open tracking. The difference is the recipient (the operator
// inbox, OPERATOR_EMAIL) and ReplyTo (the applicant), so the operator can reply
// to a vetting conversation directly from the notification. POSTMARK_TOKEN is
// fetched from Secrets Manager at cold start (see handler.mjs) — never a
// plaintext env var.
const POSTMARK_API = 'https://api.postmarkapp.com/email'
const STREAM = 'outbound'
const FROM_NAME = 'The Ground State Society'

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

// Plain, human-readable labels for each field in the notification.
const FIELDS = [
  ['name', 'Name'],
  ['email', 'Email'],
  ['company', 'Company'],
  ['role', 'Role'],
  ['applicantType', 'Applying as'],
  ['stage', 'Funding stage'],
  ['modality', 'Modality'],
  ['want', 'What they want from the room'],
]

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

export function buildApplicationEmail({ application }) {
  const subject = `New application — ${application.company} (${application.name})`

  const rows = FIELDS.map(
    ([k, label]) =>
      `<tr><td style="padding:6px 12px 6px 0;font:600 13px/1.5 ${FONT};color:#432d16;vertical-align:top;white-space:nowrap;">${esc(label)}</td><td style="padding:6px 0;font:400 14px/1.6 ${FONT};color:#08080a;">${esc(application[k])}</td></tr>`,
  ).join('')

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f7ff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7ff;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e6ef;border-radius:10px;">
        <tr><td style="padding:28px 32px 0;">
          <p style="margin:0;font:600 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;color:#432d16;">The Ground State Society</p>
          <h1 style="margin:14px 0 18px;font:700 20px/1.3 ${FONT};color:#08080a;">New membership application</h1>
        </td></tr>
        <tr><td style="padding:0 32px 26px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${rows}</table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const text = `THE GROUND STATE SOCIETY — new membership application

${FIELDS.map(([k, label]) => `${label}: ${application[k] ?? ''}`).join('\n')}`

  return { subject, html, text }
}

export async function notifyOperator({ application }) {
  const { subject, html, text } = buildApplicationEmail({ application })
  const res = await fetch(POSTMARK_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Postmark-Server-Token': process.env.POSTMARK_TOKEN,
    },
    body: JSON.stringify({
      From: `${FROM_NAME} <${process.env.FROM_ADDRESS}>`,
      To: process.env.OPERATOR_EMAIL,
      // Reply lands in the applicant's inbox so vetting can start from the notification.
      ReplyTo: application.email,
      Subject: subject,
      HtmlBody: html,
      TextBody: text,
      MessageStream: STREAM,
      // Transactional, internal notification — no link rewrite, no open pixel.
      TrackOpens: false,
      TrackLinks: 'None',
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`postmark_send_failed ${res.status}: ${detail}`)
  }
}
