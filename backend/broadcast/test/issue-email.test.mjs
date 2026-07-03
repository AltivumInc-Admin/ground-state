import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderIssueEmail } from '../src/issue-email.mjs'

const issue = {
  slug: 'funding-roundup-q2',
  title: 'Funding Roundup: Q2',
  publishedAt: '2026-06-24T00:00:00Z',
  excerpt: 'Big week: $1.2B raised.',
  seo: {},
  body: [
    { _type: 'block', style: 'h2', _key: '1', markDefs: [], children: [{ _type: 'span', _key: 's1', text: 'The rounds', marks: [] }] },
    { _type: 'block', style: 'normal', _key: '2', markDefs: [{ _type: 'link', _key: 'l1', href: 'https://x.test' }], children: [{ _type: 'span', _key: 's2', text: '$2M seed', marks: ['l1'] }] },
    { _type: 'pteImage', _key: '3', url: 'https://cdn.test/a.png', alt: 'a particle', caption: 'Fig 1' },
  ],
}

test('renderIssueEmail produces subject, html, text', () => {
  const { subject, html, text, fromName } = renderIssueEmail({ issue, siteUrl: 'https://groundstatesociety.com' })
  assert.equal(subject, 'Funding Roundup: Q2')
  // Body rendered
  assert.match(html, /The rounds/)
  assert.match(html, /href="https:\/\/x\.test"/)
  assert.match(html, /\$2M seed/) // dollar figure intact
  assert.match(html, /<img[^>]+src="https:\/\/cdn\.test\/a\.png"[^>]+alt="a particle"/)
  // Compliance: unsubscribe placeholder + identity + canonical link to the web version
  assert.match(html, /\{\{\{ pm:unsubscribe \}\}\}/)
  assert.match(html, /Altivum Inc/)
  assert.match(html, /groundstatesociety\.com\/signal\/funding-roundup-q2/)
  assert.match(text, /\{\{\{ pm:unsubscribe \}\}\}/)
  // fromName
  assert.equal(fromName, 'The Ground State Society')
  // plain-text body contains rendered block content (not just excerpt)
  assert.match(text, /The rounds/)
})

test('Sanity-derived url and slug-built webUrl are escaped at their HTML sinks', async () => {
  const { renderIssueEmail, UNSUBSCRIBE_PLACEHOLDER } = await import('../src/issue-email.mjs')
  const hostile = {
    ...issue,
    body: [{ _type: 'pteImage', _key: 'x', url: 'https://cdn.test/a.png"onerror="alert(1)', alt: 'a' }],
  }
  const { html } = renderIssueEmail({ issue: hostile, siteUrl: 'https://groundstatesociety.com' })
  assert.doesNotMatch(html, /"onerror="/)
  assert.match(html, /&quot;onerror=&quot;/)
  // The compliance token is the shared constant, present in both bodies
  const { html: h2, text: t2 } = renderIssueEmail({ issue, siteUrl: 'https://x.co' })
  assert.ok(h2.includes(UNSUBSCRIBE_PLACEHOLDER))
  assert.ok(t2.includes(UNSUBSCRIBE_PLACEHOLDER))
})

test('unknown Portable Text types are collected, not silently vanished', async () => {
  const { renderIssueEmail } = await import('../src/issue-email.mjs')
  const withUnknown = {
    ...issue,
    body: [...issue.body, { _type: 'pteChart', _key: 'z', data: [1, 2] }],
  }
  const { unknownTypes } = renderIssueEmail({ issue: withUnknown, siteUrl: 'https://x.co' })
  assert.deepEqual(unknownTypes, ['pteChart'])
  const clean = renderIssueEmail({ issue, siteUrl: 'https://x.co' })
  assert.deepEqual(clean.unknownTypes, [])
})

test('schema-allowed lists render as styled ul/ol/li in the email (not library defaults)', async () => {
  const { renderIssueEmail } = await import('../src/issue-email.mjs')
  const withLists = {
    ...issue,
    body: [
      { _type: 'block', style: 'normal', listItem: 'bullet', level: 1, _key: 'b1', markDefs: [], children: [{ _type: 'span', _key: 's', text: 'first bullet', marks: [] }] },
      { _type: 'block', style: 'normal', listItem: 'bullet', level: 1, _key: 'b2', markDefs: [], children: [{ _type: 'span', _key: 's', text: 'second bullet', marks: [] }] },
      { _type: 'block', style: 'normal', listItem: 'number', level: 1, _key: 'n1', markDefs: [], children: [{ _type: 'span', _key: 's', text: 'step one', marks: [] }] },
      { _type: 'block', style: 'normal', listItem: 'number', level: 1, _key: 'n2', markDefs: [], children: [{ _type: 'span', _key: 's', text: 'step two', marks: [] }] },
    ],
  }
  const { html, text } = renderIssueEmail({ issue: withLists, siteUrl: 'https://x.co' })
  assert.match(html, /<ul style="[^"]+">/)
  assert.match(html, /<ol style="[^"]+">/)
  assert.match(html, /<li style="[^"]+">first bullet<\/li>/)
  assert.match(html, /<li style="[^"]+">step one<\/li>/)
  // text body numbers the numbered run and dashes the bullets
  assert.match(text, /- first bullet/)
  assert.match(text, /1\. step one/)
  assert.match(text, /2\. step two/)
})

test('the inline code mark renders as a styled <code> in the email', async () => {
  const { renderIssueEmail } = await import('../src/issue-email.mjs')
  const withCode = {
    ...issue,
    body: [
      { _type: 'block', style: 'normal', _key: 'c1', markDefs: [], children: [{ _type: 'span', _key: 's', text: 'hw', marks: ['code'] }] },
    ],
  }
  const { html } = renderIssueEmail({ issue: withCode, siteUrl: 'https://x.co' })
  assert.match(html, /<code style="[^"]*ui-monospace[^"]*">hw<\/code>/)
})

test('unsafe or empty link hrefs render as plain text, never a dead anchor (web-parity allowlist)', async () => {
  const { renderIssueEmail } = await import('../src/issue-email.mjs')
  const mk = (href, key) => ({
    _type: 'block', style: 'normal', _key: key,
    markDefs: href === undefined ? [{ _type: 'link', _key: `l${key}` }] : [{ _type: 'link', _key: `l${key}`, href }],
    children: [{ _type: 'span', _key: 's', text: `text-${key}`, marks: [`l${key}`] }],
  })
  const hostile = { ...issue, body: [mk('javascript:alert(1)', 'a'), mk(undefined, 'b'), mk('//evil.host/x', 'c'), mk('tel:+15551234567', 'd')] }
  const { html } = renderIssueEmail({ issue: hostile, siteUrl: 'https://x.co' })
  assert.doesNotMatch(html, /href="javascript:/)
  assert.doesNotMatch(html, /href="#"/)
  assert.doesNotMatch(html, /href="\/\/evil/)
  assert.match(html, /text-a/) // content survives as plain text
  assert.match(html, /text-b/)
  assert.match(html, /<a href="tel:\+15551234567"/) // tel is allowlisted
})

test('Sanity CDN images are sized/auto-formatted in the email; non-Sanity URLs pass through', async () => {
  const { renderIssueEmail } = await import('../src/issue-email.mjs')
  const withSanityImg = {
    ...issue,
    body: [{ _type: 'pteImage', _key: 'i', url: 'https://cdn.sanity.io/images/p/d/abc-2000x1500.png', alt: 'a' }],
  }
  const { html } = renderIssueEmail({ issue: withSanityImg, siteUrl: 'https://x.co' })
  assert.match(html, /src="https:\/\/cdn\.sanity\.io\/[^"]*\?w=1120&amp;auto=format&amp;fit=max&amp;q=75"/)
  // the existing fixture's non-Sanity URL keeps passing through untransformed
  const { html: h2 } = renderIssueEmail({ issue, siteUrl: 'https://x.co' })
  assert.match(h2, /src="https:\/\/cdn\.test\/a\.png"/)
})
