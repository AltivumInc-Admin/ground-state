import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { SITE } from './site.js'

// Exported so a test can assert they stay in sync with index.html's static head
// (these intentionally duplicate it; the test is the drift guard).
export const DEFAULT_TITLE = 'The Ground State Society — The Private Network for Quantum Founders'
export const DEFAULT_DESCRIPTION =
  'The Ground State Society is the private, members-only network for quantum founders. Curated peer circles, capital access, and domain-deep acceleration. By application only — the free Signal tier is open to every quantum builder.'
// The homepage's hand-tuned OG/Twitter description (index.html) is punchier than
// the plain meta description — keep it distinct so a reset restores the real copy,
// not the SERP description.
export const DEFAULT_OG_DESCRIPTION =
  'The room where the people building the quantum economy share deal flow, hard-won lessons, and warm access to capital, customers, and talent. By application only.'
// Positive directives let Google use full passages + large image previews in
// classic SERPs AND in AI Overviews / AI Mode (max-snippet gates how much text
// can feed an AI answer). Must match index.html's static robots meta so the
// homepage isn't downgraded on hydration.
export const ROBOTS_INDEX = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'

function setNameMeta(name, content) {
  const el = document.querySelector(`meta[name="${name}"]`)
  if (el) el.setAttribute('content', content)
}

function setPropMeta(property, content) {
  const el = document.querySelector(`meta[property="${property}"]`)
  if (el) el.setAttribute('content', content)
}

/*
 * Per-route document head: title, description, canonical, robots, and the
 * social (Open Graph / Twitter) title-description-url. An SPA has one <head>
 * for six routes — without this, every route presents as the homepage to
 * assistive tech (WCAG 2.4.2), to search, and to link unfurls. The prerendered
 * routes (/, /story) also carry these in static HTML for non-JS crawlers; this
 * hook keeps the hydrated/client-rendered routes in sync.
 */
export default function usePageMeta({ title, description, noindex = false } = {}) {
  const { pathname } = useLocation()

  useEffect(() => {
    const fullTitle = title ? `${title} — The Ground State Society` : DEFAULT_TITLE
    const desc = description || DEFAULT_DESCRIPTION
    const url = SITE + (pathname === '/' ? '/' : pathname)

    document.title = fullTitle
    setNameMeta('description', desc)

    const canonical = document.querySelector('link[rel="canonical"]')
    if (canonical) canonical.href = url
    setPropMeta('og:url', url)

    // Always write the social title/description so navigating back to the
    // homepage RESETS them — otherwise a subpage's OG/Twitter copy leaks onto
    // the homepage after SPA navigation. The homepage falls back to its own
    // hand-tuned defaults (which differ from the plain meta description).
    // og/twitter title is always fullTitle: when no title is passed, fullTitle
    // already falls back to DEFAULT_TITLE, so a separate ogTitle was redundant.
    const ogDesc = description || DEFAULT_OG_DESCRIPTION
    setPropMeta('og:title', fullTitle)
    setNameMeta('twitter:title', fullTitle)
    setPropMeta('og:description', ogDesc)
    setNameMeta('twitter:description', ogDesc)

    let robots = document.querySelector('meta[name="robots"]')
    if (!robots) {
      robots = document.createElement('meta')
      robots.name = 'robots'
      document.head.appendChild(robots)
    }
    robots.content = noindex ? 'noindex, follow' : ROBOTS_INDEX
  }, [title, description, noindex, pathname])
}
