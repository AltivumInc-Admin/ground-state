/**
 * Inject per-route head values into prerendered HTML.
 *
 * Hardening contract:
 *  - ESCAPING: every interpolated value is HTML-escaped (escapeHtml) before
 *    insertion, so a CMS-sourced title/description containing " & < > cannot
 *    break out of its attribute or the <title> element. This is correctness for
 *    ordinary editorial punctuation (a quote or an ampersand) AND defense-in-depth
 *    against markup injection from the content layer.
 *  - $-SAFETY: replacements use the FUNCTION form of String.prototype.replace so
 *    an interpolated value can never be reinterpreted as a $-replacement token
 *    ($1, $&, $`, $', $$) — e.g. funding figures like "$1.2B".
 *  - FAIL-LOUD: each REQUESTED field must match its target tag at least once.
 *    index.html uses single-line meta tags; if one is reformatted across lines or
 *    renamed, the regex stops matching and the swap would silently no-op. A
 *    zero-match throws, turning a silent SEO regression (wrong canonical, an
 *    indexable noindex page) into a hard build failure.
 *
 * @param {string} html  — full HTML string (the dist/index.html template)
 * @param {{ title?: string, description?: string, canonical?: string,
 *            image?: string, ogType?: string, robots?: string }} opts
 * @returns {string}
 */

// Each field maps to the tags it must update. Every pattern is written in
// (open)(close) capture-group form — including <title>, whose inner text node is
// captured as the gap between the groups — so one replacement strategy
// (`${open}${escaped}${close}`) covers them all.
const FIELDS = {
  title: [
    /(<title>)[\s\S]*?(<\/title>)/,
    /(<meta property="og:title" content=")[^"]*(")/,
    /(<meta name="twitter:title" content=")[^"]*(")/,
  ],
  description: [
    /(<meta name="description" content=")[^"]*(")/,
    /(<meta property="og:description" content=")[^"]*(")/,
    /(<meta name="twitter:description" content=")[^"]*(")/,
  ],
  canonical: [
    /(<link rel="canonical" href=")[^"]*(")/,
    /(<meta property="og:url" content=")[^"]*(")/,
  ],
  image: [
    /(<meta property="og:image" content=")[^"]*(")/,
    /(<meta name="twitter:image" content=")[^"]*(")/,
  ],
  ogType: [/(<meta property="og:type" content=")[^"]*(")/],
  robots: [/(<meta name="robots" content=")[^"]*(")/],
}

/**
 * Escape a value for HTML attribute / text-node context. Encodes the five
 * characters that can break out of a double-quoted attribute or an element:
 * & < > and ". (Single quotes are safe inside double-quoted attributes.)
 */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function injectHead(html, opts = {}) {
  let out = html

  for (const [field, patterns] of Object.entries(FIELDS)) {
    const value = opts[field]
    // Only act on fields actually requested; an empty value is treated as
    // "not provided" (preserves the previous truthy-guard behaviour and avoids
    // wiping a tag with an empty string).
    if (value == null || value === '') continue

    const escaped = escapeHtml(value)
    for (const re of patterns) {
      let matched = false
      out = out.replace(re, (_m, open, close) => {
        matched = true
        return `${open}${escaped}${close}`
      })
      if (!matched) {
        throw new Error(
          `injectHead: "${field}" was requested but its target tag was not found ` +
            `(index.html formatting drift?) — pattern ${re}`,
        )
      }
    }
  }

  return out
}
