import { createClient } from '@sanity/client'
import { toHTML } from '@portabletext/to-html'

const ISSUE_QUERY = `*[_type == "issue" && status == "published" && slug.current == $slug][0]{
  "slug": slug.current,
  title,
  publishedAt,
  excerpt,
  body[]{
    ...,
    _type == "pteImage" => { ..., "url": image.asset->url }
  }
}`

export async function fetchIssue({ slug, projectId, dataset, apiVersion = '2026-06-01' }) {
  // timeout (ms) is @sanity/client's request timeout — bounded so a hung
  // Sanity API fails loudly instead of hanging the CLI indefinitely.
  const client = createClient({ projectId, dataset, apiVersion, useCdn: false, timeout: 15000 })
  return client.fetch(ISSUE_QUERY, { slug })
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Sanity assets accept transform params — request a sized, auto-formatted
// image instead of the full-resolution original. Mirrors the web renderer's
// convention (src/components/IssueBody.jsx sizedSanityUrl); the packages are
// independent by design, so keep the two in sync by hand.
function sizedSanityUrl(url, width) {
  if (typeof url !== 'string' || !url.includes('cdn.sanity.io') || url.includes('?')) return url
  return `${url}?w=${width}&auto=format&fit=max&q=75`
}

// Email-context link classifier mirroring the web renderer's allowlist
// (IssueBody.jsx classifyLink): only absolute http(s)/mailto/tel render as
// anchors. Anything else — empty href, javascript:/data:, //host, or a bare
// relative path (dead inside an email client anyway) — renders as plain text
// instead of a styled, dead link.
function emailHref(rawHref) {
  const href = String(rawHref ?? '').trim()
  const lower = href.toLowerCase()
  if (lower.startsWith('https://') || lower.startsWith('http://')) return href
  if (lower.startsWith('mailto:') || lower.startsWith('tel:')) return href
  return null
}

function blocksToText(blocks) {
  let n = 0 // running counter for a consecutive numbered-list run
  return (blocks ?? [])
    .map((b) => {
      if (b._type === 'pteImage') {
        n = 0
        return b.caption ? `[Image: ${b.caption}]` : '[Image]'
      }
      if (b._type !== 'block') {
        n = 0
        return ''
      }
      const t = (b.children ?? []).map((c) => c.text ?? '').join('')
      if (b.listItem === 'number') {
        n += 1
        return `${n}. ${t}`
      }
      n = 0
      return b.listItem ? `- ${t}` : t
    })
    .filter((line) => line !== '')
    .join('\n\n')
}

// Email-safe serializers. Inline styles only; no class hooks survive in email.
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const components = {
  block: {
    h2: ({ children }) => `<h2 style="margin:28px 0 10px;font:700 20px/1.3 ${FONT};color:#08080a;">${children}</h2>`,
    h3: ({ children }) => `<h3 style="margin:24px 0 8px;font:700 16px/1.3 ${FONT};color:#432d16;">${children}</h3>`,
    blockquote: ({ children }) => `<blockquote style="margin:18px 0;padding:4px 0 4px 16px;border-left:2px solid #b7a781;font:400 17px/1.6 ${FONT};color:#432d16;">${children}</blockquote>`,
    normal: ({ children }) => `<p style="margin:0 0 16px;font:400 15px/1.7 ${FONT};color:#432d16;">${children}</p>`,
  },
  // The schema (studio/schemaTypes/objects/blockContent.ts) is the contract:
  // every style/list/mark it allows must have a deliberate serializer here —
  // library defaults render unstyled and the unknown-type warning cannot fire
  // for known constructs.
  list: {
    bullet: ({ children }) => `<ul style="margin:0 0 16px;padding:0 0 0 22px;">${children}</ul>`,
    number: ({ children }) => `<ol style="margin:0 0 16px;padding:0 0 0 22px;">${children}</ol>`,
  },
  listItem: {
    bullet: ({ children }) => `<li style="margin:0 0 6px;font:400 15px/1.7 ${FONT};color:#432d16;">${children}</li>`,
    number: ({ children }) => `<li style="margin:0 0 6px;font:400 15px/1.7 ${FONT};color:#432d16;">${children}</li>`,
  },
  marks: {
    strong: ({ children }) => `<strong>${children}</strong>`,
    em: ({ children }) => `<em>${children}</em>`,
    code: ({ children }) =>
      `<code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;background:#f1f1f6;border-radius:4px;padding:1px 5px;color:#08080a;">${children}</code>`,
    link: ({ children, value }) => {
      const href = emailHref(value?.href)
      if (!href) return children
      return `<a href="${escapeHtml(href)}" style="color:#4a6878;">${children}</a>`
    },
  },
  types: {
    pteImage: ({ value }) =>
      value?.url
        ? `<figure style="margin:22px 0;"><img src="${escapeHtml(sizedSanityUrl(value.url, 1120))}" alt="${escapeHtml(value.alt)}" style="display:block;width:100%;border:1px solid #e6e6ef;"/>${value.caption ? `<figcaption style="margin-top:8px;font:400 12px/1.5 ${FONT};color:#9a9aa6;">${escapeHtml(value.caption)}</figcaption>` : ''}</figure>`
        : '',
  },
}

const FROM_NAME = 'The Ground State Society'
const ENTITY = 'The Ground State Society · operated by Altivum Inc.'
const WHY = 'You are receiving this because you confirmed your subscription to The Signal at groundstatesociety.com.'

// The CAN-SPAM/GDPR-critical Postmark token — one constant, referenced by the
// renderer's two bodies AND the CLI's refuse-to-send compliance check.
export const UNSUBSCRIBE_PLACEHOLDER = '{{{ pm:unsubscribe }}}'

export function renderIssueEmail({ issue, siteUrl }) {
  // Unknown Portable Text types would otherwise vanish silently from the
  // rendered email — collect them so the CLI can surface a loud warning.
  const unknownTypes = []
  const bodyHtml = toHTML(issue.body ?? [], {
    components,
    onMissingComponent: (_message, context) => {
      unknownTypes.push(context?.type ?? context?.nodeType ?? 'unknown')
    },
  })
  const webUrl = `${siteUrl}/signal/${issue.slug}`
  const date = issue.publishedAt
    ? new Date(issue.publishedAt).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f7ff;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f7f7ff;">${escapeHtml(issue.excerpt)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7ff;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid #e6e6ef;border-radius:10px;">
        <tr><td style="padding:28px 32px 0;">
          <p style="margin:0;font:600 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;color:#b7a781;">The Signal</p>
        </td></tr>
        <tr><td style="padding:14px 32px 0;">
          <h1 style="margin:0 0 6px;font:700 24px/1.25 ${FONT};color:#08080a;">${escapeHtml(issue.title)}</h1>
          <p style="margin:0 0 20px;font:400 12px/1.5 ui-monospace,monospace;color:#9a9aa6;">${date}</p>
        </td></tr>
        <tr><td style="padding:0 32px;">${bodyHtml}</td></tr>
        <tr><td style="padding:8px 32px 0;">
          <p style="margin:0;font:400 13px/1.6 ${FONT};color:#6b6b76;">Read this issue on the web: <a href="${escapeHtml(webUrl)}" style="color:#4a6878;">${escapeHtml(webUrl)}</a></p>
        </td></tr>
        <tr><td style="padding:20px 32px;"><hr style="border:0;border-top:1px solid #e6e6ef;margin:0;"></td></tr>
        <tr><td style="padding:0 32px 28px;">
          <p style="margin:0 0 6px;font:400 12px/1.6 ${FONT};color:#9a9aa6;">${WHY}</p>
          <p style="margin:0 0 6px;font:400 12px/1.6 ${FONT};color:#9a9aa6;">${ENTITY}</p>
          <p style="margin:0;font:400 12px/1.6 ${FONT};color:#9a9aa6;">${UNSUBSCRIBE_PLACEHOLDER}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const text = `THE SIGNAL

${issue.title}
${date}

${blocksToText(issue.body)}

Read on the web: ${webUrl}

—
${WHY}
${ENTITY}
${UNSUBSCRIBE_PLACEHOLDER}`

  return { subject: issue.title, html, text, fromName: FROM_NAME, unknownTypes: [...new Set(unknownTypes)] }
}
