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
