/*
 * Prerender the indexable routes into static HTML so their content + head
 * paint from HTML before React boots. Runs after the client and SSR builds:
 *   vite build && vite build --ssr src/entry-static.jsx --outDir dist-ssr
 *
 * Why this matters for SEO/AEO: AI answer-engine crawlers (GPTBot,
 * OAI-SearchBot, ClaudeBot, PerplexityBot, …) do NOT execute JavaScript, so a
 * client-rendered route is invisible to them. We prerender:
 *   /        → dist/index.html   (the Amplify catch-all serves this everywhere)
 *   /story   → dist/story.html   (the founder / E-E-A-T narrative)
 * Each #root is stamped data-route so main.jsx only hydrates when the served
 * markup matches the current path — making /story safe even before the Amplify
 * rewrite that serves story.html is in place (it falls back to client render).
 */
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises'
import { createElement } from 'react'
import { prerender } from 'react-dom/static'
import { injectHead, escapeHtml } from './lib/inject-head.mjs'
import { buildSitemapEntries, renderSitemap, issueLastmod } from './lib/sitemap.mjs'
import { SITE } from '../src/lib/site.js'

const { default: Static } = await import(
  new URL('../dist-ssr/entry-static.js', import.meta.url).href
)

// `expect` is a marker that MUST appear in the rendered markup — a guard so a
// silently-broken render can't ship. `head` overrides (omitted for "/" which
// keeps index.html's hand-tuned head) are applied at write time.
const ROUTES = [
  {
    path: '/',
    file: 'index.html',
    expect: 'hero-wordmark',
    sitemap: { priority: '1.0', changefreq: 'monthly', lastmod: '2026-06-21' },
  },
  {
    path: '/story',
    file: 'story.html',
    expect: 'story-title',
    head: {
      title: 'The Story — The Ground State Society',
      description:
        'Why The Ground State Society exists — the room being built for the people building the quantum economy, operated by Christian Perez, a Green Beret veteran who builds quantum systems on AWS.',
      canonical: `${SITE}/story`,
    },
    sitemap: { priority: '0.7', changefreq: 'monthly', lastmod: '2026-06-21' },
  },
  {
    // /apply is index,follow — prerender it so non-JS crawlers get the real
    // application page (not the Amplify catch-all's homepage HTML). Needs the
    // /apply → /apply.html rewrite applied in the Amplify console to take effect;
    // until then it falls back to client render (data-route gate in main.jsx).
    path: '/apply',
    file: 'apply.html',
    expect: 'apply-title',
    head: {
      title: 'Apply to join The Round — The Ground State Society',
      description:
        'The application for The Round — the vetted peer network for quantum founders. Reviewed personally.',
      canonical: `${SITE}/apply`,
    },
    sitemap: { priority: '0.8', changefreq: 'monthly', lastmod: '2026-06-24' },
  },
]

const SIGNAL_OG = `${SITE}/og.png`
const issues = JSON.parse(
  await readFile(new URL('../src/content/issues.generated.json', import.meta.url), 'utf8'),
)

// Archive index
ROUTES.push({
  path: '/signal',
  file: 'signal.html',
  expect: 'signal-archive',
  head: {
    title: 'The Signal — The Ground State Society',
    description:
      'The Signal — funding moves, ecosystem intel, and hard-won lessons for the people building the quantum economy. Free to read.',
    canonical: `${SITE}/signal`,
  },
  sitemap: { priority: '0.8', changefreq: 'weekly', lastmod: '2026-06-26' },
})

// One page per published issue
for (const issue of issues) {
  const head = {
    title: `${issue.seo?.title || issue.title} — The Ground State Society`,
    description: issue.seo?.description || issue.excerpt || '',
    canonical: `${SITE}/signal/${issue.slug}`,
    image: issue.seo?.ogImage ? `${issue.seo.ogImage}?w=1200&h=630&fit=crop&auto=format` : SIGNAL_OG,
    ogType: 'article',
  }
  // A custom issue image needs its own alt; when we fall back to the default
  // og.png, index.html's (correct) particle-art alt is left in place.
  if (issue.seo?.ogImage) {
    head.imageAlt = issue.seo?.title || issue.title
  }
  if (issue.seo?.noIndex) {
    head.robots = 'noindex, follow'
  }
  ROUTES.push({
    path: `/signal/${issue.slug}`,
    file: `signal/${issue.slug}.html`,
    expect: 'signal-issue',
    head,
    indexable: !issue.seo?.noIndex,
    sitemap: { priority: '0.6', changefreq: 'monthly', lastmod: issueLastmod(issue.publishedAt) },
  })
}

// A production build should prerender issues; zero is normal only for an
// empty/preview build. Make the anomaly greppable in the Amplify build log so a
// content-loss event (e.g. lost Sanity creds) is visible rather than silent.
if (issues.length === 0) {
  console.warn('prerender: WARNING — 0 issues prerendered (newsletter archive has no issue pages)')
}

const indexPath = new URL('../dist/index.html', import.meta.url)
const template = await readFile(indexPath, 'utf8')
const shell = '<div id="root"></div>'
if (!template.includes(shell)) {
  throw new Error('prerender: #root shell not found in dist/index.html')
}

// injectHead/escapeHtml are imported from ./lib/inject-head.mjs — see that
// module for the function-form + escaping rationale ($ tokens in funding
// figures, and injectHead throwing if any requested head field fails to swap).

for (const route of ROUTES) {
  const { prelude } = await prerender(createElement(Static, { url: route.path }))
  const markup = await new Response(prelude).text()

  if (!markup.includes(route.expect)) {
    throw new Error(`prerender: "${route.expect}" missing from ${route.path} markup`)
  }

  // Function-form replace so any $-token in the rendered markup (e.g. the
  // "$4.1B" funding figures) is inserted verbatim rather than read as a
  // $-replacement pattern; route.path is escaped for the data-route attribute.
  let html = template.replace(
    shell,
    () => `<div id="root" data-prerendered="true" data-route="${escapeHtml(route.path)}">${markup}</div>`,
  )
  // injectHead throws if any requested head field fails to swap, so the prior
  // standalone title canary is no longer needed.
  if (route.head) {
    html = injectHead(html, route.head)
  }

  const outUrl = new URL(`../dist/${route.file}`, import.meta.url)
  await mkdir(new URL('.', outUrl), { recursive: true })
  await writeFile(outUrl, html)
  console.log(`prerender: ${route.path} → dist/${route.file} (${(markup.length / 1024).toFixed(1)} kB)`)
}

// Regenerate sitemap.xml from the SAME routes we just prerendered — one source
// of truth, so the sitemap can't desync from what is actually served, and the
// noIndex exclusion lives only on the route (indexable flag). The Amplify
// catch-all excludes .xml, so dist/sitemap.xml is served directly.
const sitemapEntries = buildSitemapEntries(ROUTES, SITE)
// Write guard, matching the fail-loud pattern of the other prerender steps:
// the homepage URL must always be present, else generation is broken.
if (!sitemapEntries.some((e) => e.loc === `${SITE}/`)) {
  throw new Error('prerender: sitemap is missing the homepage URL — generation is broken')
}
await writeFile(new URL('../dist/sitemap.xml', import.meta.url), renderSitemap(sitemapEntries))
console.log(`prerender: sitemap.xml → ${sitemapEntries.length} urls`)

await rm(new URL('../dist-ssr/', import.meta.url), { recursive: true, force: true })
