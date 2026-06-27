import { createClient } from '@sanity/client'
import { toHTML } from '@portabletext/to-html'

const ISSUE_QUERY = `*[_type == "issue" && status == "published" && slug.current == $slug][0]{
  "slug": slug.current,
  title,
  publishedAt,
  excerpt,
  "seo": { "title": coalesce(seo.title, title), "noIndex": seo.noIndex == true },
  body[]{
    ...,
    _type == "pteImage" => { ..., "url": image.asset->url }
  }
}`

export async function fetchIssue({ slug, projectId, dataset, apiVersion = '2026-06-01' }) {
  const client = createClient({ projectId, dataset, apiVersion, useCdn: false })
  return client.fetch(ISSUE_QUERY, { slug })
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
  marks: {
    strong: ({ children }) => `<strong>${children}</strong>`,
    em: ({ children }) => `<em>${children}</em>`,
    link: ({ children, value }) => `<a href="${value?.href ?? '#'}" style="color:#4a6878;">${children}</a>`,
  },
  types: {
    pteImage: ({ value }) =>
      value?.url
        ? `<figure style="margin:22px 0;"><img src="${value.url}" alt="${value.alt ?? ''}" style="display:block;width:100%;border:1px solid #e6e6ef;"/>${value.caption ? `<figcaption style="margin-top:8px;font:400 12px/1.5 ${FONT};color:#9a9aa6;">${value.caption}</figcaption>` : ''}</figure>`
        : '',
  },
}

const FROM_NAME = 'The Ground State Society'
const ENTITY = 'The Ground State Society · operated by Altivum Inc.'
const WHY = 'You are receiving this because you confirmed your subscription to The Signal at groundstatesociety.com.'

export function renderIssueEmail({ issue, siteUrl }) {
  const bodyHtml = toHTML(issue.body ?? [], { components })
  const webUrl = `${siteUrl}/signal/${issue.slug}`
  const date = issue.publishedAt
    ? new Date(issue.publishedAt).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f7ff;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f7f7ff;">${issue.excerpt ?? ''}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7ff;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid #e6e6ef;border-radius:10px;">
        <tr><td style="padding:28px 32px 0;">
          <p style="margin:0;font:600 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;color:#b7a781;">The Signal</p>
        </td></tr>
        <tr><td style="padding:14px 32px 0;">
          <h1 style="margin:0 0 6px;font:700 24px/1.25 ${FONT};color:#08080a;">${issue.title}</h1>
          <p style="margin:0 0 20px;font:400 12px/1.5 ui-monospace,monospace;color:#9a9aa6;">${date}</p>
        </td></tr>
        <tr><td style="padding:0 32px;">${bodyHtml}</td></tr>
        <tr><td style="padding:8px 32px 0;">
          <p style="margin:0;font:400 13px/1.6 ${FONT};color:#6b6b76;">Read this issue on the web: <a href="${webUrl}" style="color:#4a6878;">${webUrl}</a></p>
        </td></tr>
        <tr><td style="padding:20px 32px;"><hr style="border:0;border-top:1px solid #e6e6ef;margin:0;"></td></tr>
        <tr><td style="padding:0 32px 28px;">
          <p style="margin:0 0 6px;font:400 12px/1.6 ${FONT};color:#9a9aa6;">${WHY}</p>
          <p style="margin:0 0 6px;font:400 12px/1.6 ${FONT};color:#9a9aa6;">${ENTITY}</p>
          <p style="margin:0;font:400 12px/1.6 ${FONT};color:#9a9aa6;">{{{ pm:unsubscribe }}}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const text = `THE SIGNAL

${issue.title}
${date}

${issue.excerpt ?? ''}

Read on the web: ${webUrl}

—
${WHY}
${ENTITY}
{{{ pm:unsubscribe }}}`

  return { subject: issue.title, html, text, fromName: FROM_NAME }
}
