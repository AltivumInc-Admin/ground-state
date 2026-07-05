import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { prefersReducedMotion } from './motion.js'

/*
 * Quantized page transitions — a route change enacts the brand metaphor:
 * a discrete state transition, not a glide. React Router's own
 * `viewTransition` prop is a data-router feature (RouterProvider); this app
 * deliberately stays on the declarative <BrowserRouter> for the
 * prerender/hydrate pipeline, so the wrap happens here instead — the same
 * document.startViewTransition(() => flushSync(navigate())) the data router
 * performs internally.
 *
 * `morphName` marks the CLICKED element as the transition's shared-element
 * source (view-transition-name). Several CTAs route to /apply; naming them
 * all statically would either duplicate the name inside one frame (the
 * browser then skips the whole transition) or morph from an off-screen
 * sibling instead of the control the visitor actually pressed.
 *
 * Browsers without the API, modified clicks, same-route clicks, and both
 * motion gates all fall through to <Link>'s default navigation untouched.
 */
export function useVtNavigate() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return useCallback(
    (e, to, morphName) => {
      if (e.defaultPrevented) return
      // Modified/aux clicks belong to the browser (new tab, download…)
      if (e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
      if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function')
        return
      // A same-route click only re-scrolls — transitioning to identical
      // content reads as a glitch, not a state change.
      if ((to.split('#')[0] || '/') === pathname) return
      // Both motion gates, read at click time: the OS setting and the site's
      // pause toggle (mirrored to <html data-motion-paused> by motion.js).
      if (prefersReducedMotion() || document.documentElement.hasAttribute('data-motion-paused'))
        return

      e.preventDefault()
      const source = morphName ? e.currentTarget : null
      // Before startViewTransition — the old frame snapshots synchronously.
      if (source) source.style.viewTransitionName = morphName
      document.startViewTransition(() => {
        // flushSync commits the new route before the new-frame snapshot.
        flushSync(() => navigate(to))
        // Clear INSIDE the update, before that snapshot: a source that
        // persists across routes (the nav CTA) would otherwise carry the
        // name into the new frame and collide with the destination element —
        // a duplicate name makes the browser abort the transition.
        if (source) source.style.viewTransitionName = ''
      })
    },
    [navigate, pathname],
  )
}
