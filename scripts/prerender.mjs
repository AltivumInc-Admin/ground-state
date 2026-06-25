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
import { readFile, writeFile, rm } from 'node:fs/promises'
import { createElement } from 'react'
import { prerender } from 'react-dom/static'

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

const indexPath = new URL('../dist/index.html', import.meta.url)
const template = await readFile(indexPath, 'utf8')
const shell = '<div id="root"></div>'
if (!template.includes(shell)) {
  throw new Error('prerender: #root shell not found in dist/index.html')
}

// Single-line meta tags in index.html make these targeted swaps reliable.
function injectHead(html, { title, description, canonical }) {
  let out = html
  if (title) {
    out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    out = out.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
    out = out.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`)
  }
  if (description) {
    out = out.replace(/(<meta name="description" content=")[^"]*(")/, `$1${description}$2`)
    out = out.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${description}$2`)
    out = out.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${description}$2`)
  }
  if (canonical) {
    out = out.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`)
    out = out.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonical}$2`)
  }
  return out
}

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

  await writeFile(new URL(`../dist/${route.file}`, import.meta.url), html)
  console.log(`prerender: ${route.path} → dist/${route.file} (${(markup.length / 1024).toFixed(1)} kB)`)
}

await rm(new URL('../dist-ssr/', import.meta.url), { recursive: true, force: true })
