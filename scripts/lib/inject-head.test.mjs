import { test } from 'node:test'
import assert from 'node:assert/strict'
import { injectHead } from './inject-head.mjs'

// Minimal fixture mirroring the single-line meta tags in index.html.
const FIXTURE = `<!doctype html>
<html>
<head>
  <meta name="description" content="OLD DESCRIPTION" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://example.com/" />
  <meta property="og:title" content="OLD TITLE" />
  <meta property="og:description" content="OLD OG DESC" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://example.com/" />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta name="twitter:title" content="OLD TITLE" />
  <meta name="twitter:description" content="OLD TWITTER DESC" />
  <meta name="twitter:image" content="https://example.com/og.png" />
  <title>OLD TITLE</title>
</head>
<body></body>
</html>`

// --- FIX 1 regression: dollar-sign strings must survive verbatim ---
test('description with $ tokens is injected verbatim (regression for FIX 1)', () => {
  const desc = 'Big week: $1.2B raised across $2M seed and $10M Series A.'
  const out = injectHead(FIXTURE, { description: desc })

  // The full string must appear intact inside a content="..." attribute.
  assert.ok(
    out.includes(`content="${desc}"`),
    `Expected content="${desc}" to appear verbatim in output.\nGot: ${out.slice(0, 800)}`,
  )

  // Verify function-form is required: prove the string-replacement form would corrupt it.
  // This is a documentation-only assertion on the OLD approach — we call it with a dummy
  // string to confirm the bug exists in the naive approach.
  const naiveOut = FIXTURE.replace(/(<meta name="description" content=")[^"]*(")/, `$1${desc}$2`)
  // With string replacement, "$1" is a backreference to the first capture group.
  // If the naive approach were safe, naiveOut would contain the literal desc string.
  // We assert it does NOT — proving function-form is necessary.
  assert.ok(
    !naiveOut.includes(desc),
    'Expected naive string-replacement to corrupt the $-tokens (proving function-form is required)',
  )
})

// --- robots meta swap ---
test('robots option swaps the meta name="robots" content', () => {
  const out = injectHead(FIXTURE, { robots: 'noindex, follow' })
  assert.ok(out.includes('content="noindex, follow"'), `robots not swapped.\nGot: ${out.slice(0, 400)}`)
  assert.ok(!out.includes('content="index, follow"'), 'old robots value still present')
})

// --- title swap ---
test('title swaps <title>, og:title, twitter:title', () => {
  const title = 'New Page Title — GSS'
  const out = injectHead(FIXTURE, { title })
  assert.ok(out.includes(`<title>${title}</title>`))
  assert.ok(out.includes(`og:title" content="${title}"`))
  assert.ok(out.includes(`twitter:title" content="${title}"`))
})

// --- canonical swap ---
test('canonical swaps link[rel=canonical] and og:url', () => {
  const canonical = 'https://groundstatesociety.com/signal/issue-1'
  const out = injectHead(FIXTURE, { canonical })
  assert.ok(out.includes(`href="${canonical}"`))
  assert.ok(out.includes(`og:url" content="${canonical}"`))
})

// --- image swap ---
test('image swaps og:image and twitter:image', () => {
  const image = 'https://cdn.sanity.io/images/abc/production/xyz.jpg?w=1200&h=630'
  const out = injectHead(FIXTURE, { image })
  assert.ok(out.includes(`og:image" content="${image}"`))
  assert.ok(out.includes(`twitter:image" content="${image}"`))
})

// --- ogType swap ---
test('ogType swaps og:type', () => {
  const out = injectHead(FIXTURE, { ogType: 'article' })
  assert.ok(out.includes('og:type" content="article"'))
  assert.ok(!out.includes('og:type" content="website"'))
})
