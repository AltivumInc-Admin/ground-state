import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeXml, issueLastmod, buildSitemapEntries, renderSitemap } from './sitemap.mjs'

const SITE = 'https://groundstatesociety.com'

test('escapeXml encodes & < > " and \'', () => {
  assert.equal(escapeXml(`a&b<c>d"e'f`), 'a&amp;b&lt;c&gt;d&quot;e&apos;f')
})

test('issueLastmod slices ISO to YYYY-MM-DD, null when blank', () => {
  assert.equal(issueLastmod('2026-06-20T12:00:00Z'), '2026-06-20')
  assert.equal(issueLastmod(''), null)
  assert.equal(issueLastmod(null), null)
  assert.equal(issueLastmod(undefined), null)
})

test('buildSitemapEntries derives loc from canonical, falls back to site root', () => {
  const routes = [
    { path: '/', sitemap: { priority: '1.0', changefreq: 'monthly', lastmod: '2026-06-21' } },
    { path: '/story', head: { canonical: `${SITE}/story` }, sitemap: { priority: '0.7', changefreq: 'monthly', lastmod: '2026-06-21' } },
  ]
  const entries = buildSitemapEntries(routes, SITE)
  assert.equal(entries.length, 2)
  assert.equal(entries[0].loc, `${SITE}/`)
  assert.equal(entries[1].loc, `${SITE}/story`)
  assert.equal(entries[1].priority, '0.7')
})

test('buildSitemapEntries excludes routes flagged indexable:false (noIndex issues)', () => {
  const routes = [
    { path: '/signal/keep', head: { canonical: `${SITE}/signal/keep` }, indexable: true, sitemap: { priority: '0.6', changefreq: 'monthly', lastmod: '2026-06-20' } },
    { path: '/signal/hide', head: { canonical: `${SITE}/signal/hide` }, indexable: false, sitemap: { priority: '0.6', changefreq: 'monthly', lastmod: '2026-06-20' } },
  ]
  const entries = buildSitemapEntries(routes, SITE)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].loc, `${SITE}/signal/keep`)
})

test('buildSitemapEntries skips routes without sitemap metadata', () => {
  const routes = [{ path: '/no-meta' }]
  assert.equal(buildSitemapEntries(routes, SITE).length, 0)
})

test('renderSitemap emits valid structure and omits <lastmod> when null', () => {
  const xml = renderSitemap([
    { loc: `${SITE}/`, priority: '1.0', changefreq: 'monthly', lastmod: '2026-06-21' },
    { loc: `${SITE}/no-date`, priority: '0.5', changefreq: 'weekly', lastmod: null },
  ])
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset'))
  assert.ok(xml.includes(`<loc>${SITE}/</loc>`))
  assert.ok(xml.includes('<lastmod>2026-06-21</lastmod>'))
  // the null-lastmod entry has no <lastmod> line
  assert.ok(xml.includes(`<loc>${SITE}/no-date</loc>\n    <changefreq>weekly</changefreq>`))
  assert.ok(xml.trimEnd().endsWith('</urlset>'))
})

test('renderSitemap XML-escapes a loc containing & (would otherwise break the sitemap)', () => {
  const xml = renderSitemap([{ loc: `${SITE}/signal/a&b`, priority: '0.6', changefreq: 'monthly', lastmod: null }])
  assert.ok(xml.includes(`<loc>${SITE}/signal/a&amp;b</loc>`))
  assert.ok(!xml.includes('a&b</loc>'))
})
