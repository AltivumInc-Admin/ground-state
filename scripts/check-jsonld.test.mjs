import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { extractJsonLd, validateJsonLd } from './check-jsonld.mjs'

test('extractJsonLd pulls the ld+json block out of HTML', () => {
  const html = '<head><script type="application/ld+json">{"@graph":[]}</script></head>'
  assert.equal(extractJsonLd(html).trim(), '{"@graph":[]}')
})

test('extractJsonLd throws when no ld+json block is present', () => {
  assert.throws(() => extractJsonLd('<head></head>'), /no <script type="application\/ld\+json">/)
})

test('a graph whose @id references all resolve passes', () => {
  const json = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': 'https://x/#org', founder: { '@id': 'https://x/#me' } },
      { '@type': 'Person', '@id': 'https://x/#me', worksFor: { '@id': 'https://x/#org' } },
    ],
  })
  assert.doesNotThrow(() => validateJsonLd(json))
})

test('a dangling @id reference fails', () => {
  const json = JSON.stringify({
    '@graph': [{ '@type': 'Organization', '@id': 'https://x/#org', founder: { '@id': 'https://x/#missing' } }],
  })
  assert.throws(() => validateJsonLd(json), /dangling @id reference/)
})

test('malformed JSON (trailing comma) fails', () => {
  assert.throws(() => validateJsonLd('{ "@graph": [ {}, ] }'), /not valid JSON/)
})

test('the real index.html @graph is valid and fully resolved', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  const result = validateJsonLd(extractJsonLd(html))
  assert.ok(result.nodes >= 1)
})
