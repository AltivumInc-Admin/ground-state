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

test('guardEmptyIssues: zero issues without the flag is a hard error; with the flag it warns and passes', async (t) => {
  const { guardEmptyIssues } = await import('./fetch-issues.mjs')
  assert.throws(() => guardEmptyIssues([], {}), /zero publishable issues/)
  const warnSpy = t.mock.method(console, 'warn', () => {})
  guardEmptyIssues([], { GSS_ALLOW_EMPTY_ISSUES: '1' }) // must not throw
  assert.match(warnSpy.mock.calls[0].arguments[0], /GSS_ALLOW_EMPTY_ISSUES=1/)
  guardEmptyIssues([{ slug: 'x' }], {}) // non-empty never throws
})

test('normalizeIssues warns on kept-but-degraded issues (empty body / empty title)', async (t) => {
  const { normalizeIssues } = await import('./fetch-issues.mjs')
  const warnSpy = t.mock.method(console, 'warn', () => {})
  const out = normalizeIssues([
    { slug: 'hollow', title: 'Has Title', body: [] },
    { slug: 'untitled', title: '', body: [{ _type: 'block' }] },
  ])
  assert.equal(out.length, 2) // kept, not dropped
  const warns = warnSpy.mock.calls.map((c) => c.arguments[0])
  assert.ok(warns.some((w) => /"hollow" kept with an empty body/.test(w)))
  assert.ok(warns.some((w) => /"untitled" kept with an empty title/.test(w)))
})

test('normalizeIssues drops duplicate slugs, keeping the first (newest) occurrence', async (t) => {
  const { normalizeIssues } = await import('./fetch-issues.mjs')
  const warnSpy = t.mock.method(console, 'warn', () => {})
  const out = normalizeIssues([
    { slug: 'twice', title: 'Newest', publishedAt: '2026-07-02T00:00:00Z', body: [{ _type: 'block' }] },
    { slug: 'twice', title: 'Older', publishedAt: '2026-07-01T00:00:00Z', body: [{ _type: 'block' }] },
  ])
  assert.equal(out.length, 1)
  assert.equal(out[0].title, 'Newest')
  assert.ok(warnSpy.mock.calls.some((c) => /duplicate slug "twice"/.test(c.arguments[0])))
})

test('seo fallback contract: authored values win, absent values fall back — normalizeIssues is the single owner', async () => {
  const { normalizeIssues } = await import('./fetch-issues.mjs')
  const out = normalizeIssues([
    {
      slug: 'authored', title: 'Doc Title', excerpt: 'Doc excerpt', body: [{ _type: 'block' }],
      seo: { title: 'SEO Title', description: 'SEO desc', ogImage: null, noIndex: false },
    },
    {
      slug: 'fallback', title: 'Doc Title 2', excerpt: 'Doc excerpt 2', body: [{ _type: 'block' }],
      seo: { title: null, description: null, ogImage: null, noIndex: false },
    },
  ])
  assert.equal(out[0].seo.title, 'SEO Title')
  assert.equal(out[0].seo.description, 'SEO desc')
  assert.equal(out[1].seo.title, 'Doc Title 2')
  assert.equal(out[1].seo.description, 'Doc excerpt 2')
  // The contract consumers trust: always strings
  for (const i of out) {
    assert.equal(typeof i.seo.title, 'string')
    assert.equal(typeof i.seo.description, 'string')
  }
})

test('guardEmptyIssues nags when the flag is stale (issues exist but the flag is still set)', async (t) => {
  const { guardEmptyIssues } = await import('./fetch-issues.mjs')
  const warnSpy = t.mock.method(console, 'warn', () => {})
  guardEmptyIssues([{ slug: 'first-light' }], { GSS_ALLOW_EMPTY_ISSUES: '1' }) // must not throw
  assert.match(warnSpy.mock.calls[0].arguments[0], /STALE/)
  assert.match(warnSpy.mock.calls[0].arguments[0], /first-issue-publish\.md/)
  // and stays silent when the flag is absent and issues exist
  guardEmptyIssues([{ slug: 'first-light' }], {})
  assert.equal(warnSpy.mock.calls.length, 1)
})
