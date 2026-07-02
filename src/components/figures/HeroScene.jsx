import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import SceneBoundary from '../SceneBoundary.jsx'
import { prefersReducedMotion, useMotionPaused } from '../../lib/motion.js'

/* The three.js bundle loads lazily so the page paints first. */
const GroundStateScene = lazy(() => import('../../three/GroundStateScene.jsx'))

/* If WebGL is unavailable (the boundary) or the context is lost (a DOM
   event the boundary can't see) the hero quietly falls back to the styled
   black ground — and reports through onFailed so Hero.jsx can drop the
   caption and pause toggle that describe a scene that isn't there. */
export default function HeroScene({ energyRef, onFailed }) {
  const holderRef = useRef(null)
  const [inView, setInView] = useState(true)
  // The sim's heaviest work (the 2400-particle frame loop) waits one idle
  // frame so the wordmark entrance and the fonts.ready ScrollTrigger
  // refresh land first; until then the canvas paints a single static
  // frame on demand.
  const [ready, setReady] = useState(false)
  const [lost, setLost] = useState(false)
  const [reduced] = useState(prefersReducedMotion)
  // The visitor's pause toggle reuses the reduced-motion path: static
  // cloud, still camera, frameloop on demand
  const paused = useMotionPaused()

  useEffect(() => {
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(() => setReady(true), { timeout: 1500 })
      return () => cancelIdleCallback(id)
    }
    // Safari has no requestIdleCallback — a short timeout clears the entrance
    const id = setTimeout(() => setReady(true), 300)
    return () => clearTimeout(id)
  }, [])

  // Stop the render loop entirely once the hero scrolls away.
  useEffect(() => {
    const node = holderRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '120px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const contextLost = () => {
    setLost(true)
    onFailed?.()
  }

  return (
    <div ref={holderRef} className="hero-scene" aria-hidden="true">
      {!lost && (
        <SceneBoundary onFailed={onFailed}>
          <Suspense fallback={null}>
            <GroundStateScene
              energyRef={energyRef}
              reduced={reduced || paused}
              active={inView && ready}
              onContextLost={contextLost}
            />
          </Suspense>
        </SceneBoundary>
      )}
    </div>
  )
}
