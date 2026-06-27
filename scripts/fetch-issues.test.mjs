import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeIssues } from './fetch-issues.mjs'

test('normalizeIssues keeps published fields and defaults seo from title/excerpt', () => {
  const raw = [
    {
      slug: 'first-light',
      title: 'First Light',
      publishedAt: '2026-06-20T12:00:00Z',
      excerpt: 'A short teaser.',
      seo: { title: null, description: null, ogImage: null, noIndex: false },
      body: [{ _type: 'block', children: [{ text: 'Hi' }] }],
    },
  ]
  const out = normalizeIssues(raw)
  assert.equal(out.length, 1)
  assert.equal(out[0].slug, 'first-light')
  assert.equal(out[0].seo.title, 'First Light') // falls back to title
  assert.equal(out[0].seo.description, 'A short teaser.') // falls back to excerpt
  assert.ok(Array.isArray(out[0].body))
})

test('normalizeIssues drops entries without a slug', () => {
  const out = normalizeIssues([{ title: 'No slug', body: [] }])
  assert.equal(out.length, 0)
})

test('normalizeIssues drops entries with an invalid slug (path/sitemap safety)', () => {
  const out = normalizeIssues([
    { slug: '../etc/passwd', title: 'Traversal', body: [] },
    { slug: 'a&b', title: 'Ampersand', body: [] },
    { slug: 'Has Spaces', title: 'Spaces', body: [] },
    { slug: 'valid-slug', title: 'Valid', body: [] },
  ])
  assert.equal(out.length, 1)
  assert.equal(out[0].slug, 'valid-slug')
})
