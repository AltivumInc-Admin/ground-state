import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import Cursor from './components/Cursor.jsx'
import Landing from './pages/Landing.jsx'
import StoryPage from './pages/Story.jsx'
import Apply from './pages/Apply.jsx'
import Activate from './pages/Activate.jsx'
import Welcome from './pages/Welcome.jsx'
import { ScrollTrigger } from './lib/fx.jsx'

/* Scrolls to top on route change, or to the anchor when a hash is present.
   Keyed on location.key so re-clicking the same anchor scrolls again. */
function ScrollManager() {
  const { pathname, hash, key } = useLocation()

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        // Refresh BEFORE scrolling: html{scroll-behavior:smooth} makes
        // scrollIntoView async, and a later refresh() restores the old
        // scroll position — cancelling the glide mid-flight.
        ScrollTrigger.refresh()
        el.scrollIntoView({ block: 'start' })
        return undefined
      }
    }
    // Route changes land at the top instantly — gliding up through the
    // previous page's length reads as broken, and the instant jump can't
    // be cancelled by the deferred refresh.
    window.scrollTo({ top: 0, behavior: 'instant' })
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
      <main id="main">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/story" element={<StoryPage />} />
          <Route path="/apply" element={<Apply />} />
          {/* Post-acceptance only — never linked from the page (see intent) */}
          <Route path="/activate" element={<Activate />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
