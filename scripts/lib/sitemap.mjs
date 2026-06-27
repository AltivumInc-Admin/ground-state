/*
 * Pure sitemap construction for the prerender pipeline. Dependency-free and
 * side-effect-free so it is unit-testable; scripts/prerender.mjs owns the file
 * I/O. The sitemap is derived from the SAME ROUTES list the pipeline prerenders,
 * so there is one source of truth — adding/removing a route can't desync it.
 */

const SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9'

/**
 * Escape a value for XML text/attribute context. Per the sitemaps.org spec,
 * & ' " < > must be entity-escaped inside <loc>; an unescaped & or < in a slug
 * makes crawlers reject the ENTIRE sitemap.
 */
export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Published-at ISO datetime → YYYY-MM-DD, or null when absent/blank. */
export function issueLastmod(publishedAt) {
  return (publishedAt || '').slice(0, 10) || null
}

/**
 * Derive sitemap entries from the prerendered routes. A route is included when
 * it carries `sitemap` metadata and is not flagged `indexable: false` (the
 * exclusion used for noIndex issues — a single source for "is this indexable").
 *
 * @param {Array<{ path: string, indexable?: boolean, head?: { canonical?: string },
 *                  sitemap?: { priority: string, changefreq: string, lastmod?: string|null } }>} routes
 * @param {string} site  — origin, no trailing slash
 */
export function buildSitemapEntries(routes, site) {
  return routes
    .filter((r) => r.sitemap && r.indexable !== false)
    .map((r) => ({
      loc: r.head?.canonical ?? `${site}${r.path === '/' ? '/' : r.path}`,
      priority: r.sitemap.priority,
      changefreq: r.sitemap.changefreq,
      lastmod: r.sitemap.lastmod ?? null,
    }))
}

/** Render entries to a sitemap XML string (values XML-escaped). */
export function renderSitemap(entries) {
  const body = entries
    .map((e) => {
      const lastmodLine = e.lastmod ? `    <lastmod>${escapeXml(e.lastmod)}</lastmod>\n` : ''
      return `  <url>\n    <loc>${escapeXml(e.loc)}</loc>\n${lastmodLine}    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${SITEMAP_NS}">\n${body}\n</urlset>\n`
}
