import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE = 'https://groundstatesociety.com'
const DEFAULT_TITLE = 'The Ground State Society — The Private Network for Quantum Founders'
const DEFAULT_DESCRIPTION =
  'The Ground State Society is the private, members-only network for quantum founders. Curated peer circles, warm capital introductions, and domain-deep acceleration. By application only — the free Signal tier is open to every quantum builder.'
// Positive directives let Google use full passages + large image previews in
// classic SERPs AND in AI Overviews / AI Mode (max-snippet gates how much text
// can feed an AI answer). Must match index.html's static robots meta so the
// homepage isn't downgraded on hydration.
const ROBOTS_INDEX = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'

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

    // Only override the social title/description on real subpages — the
    // homepage keeps its hand-tuned OG/Twitter copy from index.html.
    if (title) {
      setPropMeta('og:title', fullTitle)
      setNameMeta('twitter:title', fullTitle)
    }
    if (description) {
      setPropMeta('og:description', description)
      setNameMeta('twitter:description', description)
    }

    let robots = document.querySelector('meta[name="robots"]')
    if (!robots) {
      robots = document.createElement('meta')
      robots.name = 'robots'
      document.head.appendChild(robots)
    }
    robots.content = noindex ? 'noindex, follow' : ROBOTS_INDEX
  }, [title, description, noindex, pathname])
}
