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
import { injectHead } from './lib/inject-head.mjs'

const { default: Static } = await import(
  new URL('../dist-ssr/entry-static.js', import.meta.url).href
)

const SITE = 'https://groundstatesociety.com'

// `expect` is a marker that MUST appear in the rendered markup — a guard so a
// silently-broken render can't ship. `head` overrides (omitted for "/" which
// keeps index.html's hand-tuned head) are applied at write time.
const ROUTES = [
  { path: '/', file: 'index.html', expect: 'hero-wordmark' },
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
  if (issue.seo?.noIndex) {
    head.robots = 'noindex, follow'
  }
  ROUTES.push({
    path: `/signal/${issue.slug}`,
    file: `signal/${issue.slug}.html`,
    expect: 'signal-issue',
    head,
  })
}

const indexPath = new URL('../dist/index.html', import.meta.url)
const template = await readFile(indexPath, 'utf8')
const shell = '<div id="root"></div>'
if (!template.includes(shell)) {
  throw new Error('prerender: #root shell not found in dist/index.html')
}

// injectHead is imported from ./lib/inject-head.mjs — see that module for
// the function-form replacement rationale ($ tokens in funding figures).

for (const route of ROUTES) {
  const { prelude } = await prerender(createElement(Static, { url: route.path }))
  const markup = await new Response(prelude).text()

  if (!markup.includes(route.expect)) {
    throw new Error(`prerender: "${route.expect}" missing from ${route.path} markup`)
  }

  let html = template.replace(
    shell,
    `<div id="root" data-prerendered="true" data-route="${route.path}">${markup}</div>`,
  )
  if (route.head) {
    html = injectHead(html, route.head)
    // Guard against a head swap silently no-op'ing (e.g. a meta tag was
    // reformatted across lines and the regex stopped matching).
    if (!html.includes(`<title>${route.head.title}</title>`)) {
      throw new Error(`prerender: head injection failed for ${route.path} (title not swapped)`)
    }
  }

  const outUrl = new URL(`../dist/${route.file}`, import.meta.url)
  await mkdir(new URL('.', outUrl), { recursive: true })
  await writeFile(outUrl, html)
  console.log(`prerender: ${route.path} → dist/${route.file} (${(markup.length / 1024).toFixed(1)} kB)`)
}

// Regenerate sitemap.xml from the routes we just prerendered (static routes +
// every published issue). The Amplify catch-all excludes .xml, so dist/sitemap.xml
// is served directly.
const sitemapEntries = [
  { loc: `${SITE}/`, priority: '1.0', changefreq: 'monthly', lastmod: '2026-06-21' },
  { loc: `${SITE}/story`, priority: '0.7', changefreq: 'monthly', lastmod: '2026-06-21' },
  { loc: `${SITE}/apply`, priority: '0.8', changefreq: 'monthly', lastmod: '2026-06-24' },
  { loc: `${SITE}/signal`, priority: '0.8', changefreq: 'weekly', lastmod: '2026-06-26' },
  ...issues
    .filter((i) => !i.seo?.noIndex)
    .map((i) => ({
      loc: `${SITE}/signal/${i.slug}`,
      priority: '0.6',
      changefreq: 'monthly',
      lastmod: (i.publishedAt || '').slice(0, 10) || null,
    })),
]
const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  sitemapEntries
    .map((e) => {
      const lastmodLine = e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : ''
      return `  <url>\n    <loc>${e.loc}</loc>\n${lastmodLine}    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
    })
    .join('\n') +
  '\n</urlset>\n'
await writeFile(new URL('../dist/sitemap.xml', import.meta.url), sitemap)
console.log(`prerender: sitemap.xml → ${sitemapEntries.length} urls`)

await rm(new URL('../dist-ssr/', import.meta.url), { recursive: true, force: true })
