import { Suspense, lazy, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import Cursor from './components/Cursor.jsx'
import Landing from './pages/Landing.jsx'
import StoryPage from './pages/Story.jsx'
import Apply from './pages/Apply.jsx'
import { ScrollTrigger } from './lib/fx.jsx'

/* Landing, Story and Apply are prerendered + hydrated, so they stay in the main
   bundle — lazy-loading a prerendered route would hydrate through the Suspense
   fallback and flash the server HTML away. The remaining routes are JS-only
   (noindex), reached only by a deliberate click or an emailed magic link, so
   splitting them keeps their code off the landing critical path. */
const Activate = lazy(() => import('./pages/Activate.jsx'))
const Welcome = lazy(() => import('./pages/Welcome.jsx'))
const Confirm = lazy(() => import('./pages/Confirm.jsx'))

/* Scrolls to top on route change, or to the anchor when a hash is present.
   Keyed on location.key so re-clicking the same anchor scrolls again. */
function ScrollManager() {
  const { pathname, hash, key } = useLocation()
  const isFirst = useRef(true)

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        // Refresh BEFORE scrolling: html{scroll-behavior:smooth} makes
        // scrollIntoView async, and a later refresh() restores the old
        // scroll position — cancelling the glide mid-flight.
        ScrollTrigger.refresh()
        el.scrollIntoView({ block: 'start' })
        isFirst.current = false
        return undefined
      }
    }
    // Route changes land at the top instantly — gliding up through the
    // previous page's length reads as broken, and the instant jump can't
    // be cancelled by the deferred refresh.
    window.scrollTo({ top: 0, behavior: 'instant' })
    // Screen readers get no signal that an SPA "navigation" happened —
    // moving focus to main announces the new page (with its new title).
    // preventScroll: the scroll position was just set deliberately.
    // Skipped on first load so initial focus stays at the document start.
    if (isFirst.current) {
      isFirst.current = false
    } else {
      document.getElementById('main')?.focus({ preventScroll: true })
    }
    // Page height changes across routes — re-measure scroll triggers
    const id = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(id)
  }, [pathname, hash, key])

  return null
}

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <ScrollManager />
      <Cursor />
      <Nav />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/story" element={<StoryPage />} />
            <Route path="/apply" element={<Apply />} />
            {/* Post-acceptance only — never linked from the page (see intent) */}
            <Route path="/activate" element={<Activate />} />
            <Route path="/welcome" element={<Welcome />} />
            {/* Double-opt-in confirmation landing for The Signal (magic-link target) */}
            <Route path="/confirm" element={<Confirm />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
