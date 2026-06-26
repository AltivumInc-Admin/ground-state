/**
 * Inject per-route head values into prerendered HTML.
 *
 * All replacements use the FUNCTION form of String.prototype.replace so that
 * interpolated values containing JS replacement tokens ($1, $2, $&, $`, $',
 * $$) — e.g. funding figures like "$1.2B" — are inserted VERBATIM and never
 * interpreted as back-references.
 *
 * index.html uses single-line meta tags; multi-line tags will silently not
 * match (the prerender script guards with a post-swap title assertion).
 *
 * @param {string} html  — full HTML string (the dist/index.html template)
 * @param {{ title?: string, description?: string, canonical?: string,
 *            image?: string, ogType?: string, robots?: string }} opts
 * @returns {string}
 */
export function injectHead(html, { title, description, canonical, image, ogType, robots } = {}) {
  let out = html

  if (title) {
    out = out.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${title}</title>`)
    out = out.replace(/(<meta property="og:title" content=")[^"]*(")/, (m, p1, p2) => `${p1}${title}${p2}`)
    out = out.replace(/(<meta name="twitter:title" content=")[^"]*(")/, (m, p1, p2) => `${p1}${title}${p2}`)
  }

  if (description) {
    out = out.replace(/(<meta name="description" content=")[^"]*(")/, (m, p1, p2) => `${p1}${description}${p2}`)
    out = out.replace(/(<meta property="og:description" content=")[^"]*(")/, (m, p1, p2) => `${p1}${description}${p2}`)
    out = out.replace(/(<meta name="twitter:description" content=")[^"]*(")/, (m, p1, p2) => `${p1}${description}${p2}`)
  }

  if (canonical) {
    out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, (m, p1, p2) => `${p1}${canonical}${p2}`)
    out = out.replace(/(<meta property="og:url" content=")[^"]*(")/, (m, p1, p2) => `${p1}${canonical}${p2}`)
  }

  if (image) {
    out = out.replace(/(<meta property="og:image" content=")[^"]*(")/, (m, p1, p2) => `${p1}${image}${p2}`)
    out = out.replace(/(<meta name="twitter:image" content=")[^"]*(")/, (m, p1, p2) => `${p1}${image}${p2}`)
  }

  if (ogType) {
    out = out.replace(/(<meta property="og:type" content=")[^"]*(")/, (m, p1, p2) => `${p1}${ogType}${p2}`)
  }

  if (robots) {
    out = out.replace(/(<meta name="robots" content=")[^"]*(")/, (m, p1, p2) => `${p1}${robots}${p2}`)
  }

  return out
}
