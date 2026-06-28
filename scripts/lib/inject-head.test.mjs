import { test } from 'node:test'
import assert from 'node:assert/strict'
import { injectHead, escapeHtml } from './inject-head.mjs'

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
  <meta property="og:image:alt" content="OLD ALT" />
  <meta name="twitter:title" content="OLD TITLE" />
  <meta name="twitter:description" content="OLD TWITTER DESC" />
  <meta name="twitter:image" content="https://example.com/og.png" />
  <meta name="twitter:image:alt" content="OLD ALT" />
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

// --- image swap (URL & is HTML-escaped to &amp; — valid HTML, decoded on fetch) ---
test('image swaps og:image and twitter:image with the & in the URL escaped', () => {
  const image = 'https://cdn.sanity.io/images/abc/production/xyz.jpg?w=1200&h=630'
  const escaped = escapeHtml(image) // ...?w=1200&amp;h=630
  const out = injectHead(FIXTURE, { image })
  assert.ok(out.includes(`og:image" content="${escaped}"`))
  assert.ok(out.includes(`twitter:image" content="${escaped}"`))
  // The raw, unescaped & must NOT survive in an attribute value.
  assert.ok(!out.includes('?w=1200&h=630'), 'raw & should have been escaped to &amp;')
})

// --- imageAlt swap (og:image:alt + twitter:image:alt) — for custom issue images ---
test('imageAlt swaps og:image:alt and twitter:image:alt', () => {
  const out = injectHead(FIXTURE, { imageAlt: 'An issue figure' })
  assert.ok(out.includes('og:image:alt" content="An issue figure"'))
  assert.ok(out.includes('twitter:image:alt" content="An issue figure"'))
  assert.ok(!out.includes('content="OLD ALT"'), 'stale homepage alt should be replaced')
})

// --- ogType swap ---
test('ogType swaps og:type', () => {
  const out = injectHead(FIXTURE, { ogType: 'article' })
  assert.ok(out.includes('og:type" content="article"'))
  assert.ok(!out.includes('og:type" content="website"'))
})

// --- hostile input: a CMS title cannot break out of the <title> element ---
test('a title containing </title><script> is HTML-escaped, not injected', () => {
  const title = '</title><script>alert(1)</script>'
  const out = injectHead(FIXTURE, { title })
  assert.ok(!out.includes('<script>alert(1)</script>'), 'raw <script> must not appear')
  assert.ok(!out.includes('</title><script>'), 'title element must not be broken out of')
  assert.ok(out.includes('&lt;/title&gt;&lt;script&gt;'), 'metacharacters must be encoded')
})

// --- hostile input: a CMS description cannot break out of a content="..." attr ---
test('a description with quotes/ampersands/angle brackets is HTML-escaped', () => {
  const description = 'He said "hi" & pointed <left>'
  const out = injectHead(FIXTURE, { description })
  assert.ok(
    out.includes('content="He said &quot;hi&quot; &amp; pointed &lt;left&gt;"'),
    `description not escaped.\nGot: ${out.slice(0, 800)}`,
  )
  // The naked closing-quote must not appear mid-value and re-open markup.
  assert.ok(!out.includes('content="He said "hi"'), 'unescaped quote broke out of the attribute')
})

// --- fail-loud: a requested field whose tag is absent throws (silent SEO no-op guard) ---
test('injectHead throws when a requested field has no matching tag', () => {
  const noCanonical = FIXTURE.replace(/<link rel="canonical"[^>]*>/, '')
  assert.throws(
    () => injectHead(noCanonical, { canonical: 'https://groundstatesociety.com/signal/x' }),
    /canonical.*was requested but its target tag was not found/s,
  )
})

test('injectHead does not throw when every requested field is present', () => {
  assert.doesNotThrow(() =>
    injectHead(FIXTURE, {
      title: 'T',
      description: 'D',
      canonical: 'https://groundstatesociety.com/x',
      image: 'https://cdn.sanity.io/og.png',
      imageAlt: 'Issue figure',
      ogType: 'article',
      robots: 'noindex, follow',
    }),
  )
})
