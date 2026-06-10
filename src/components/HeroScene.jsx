import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react'

/* The three.js bundle loads lazily so the page paints first. */
const GroundStateScene = lazy(() => import('../three/GroundStateScene.jsx'))

/* If WebGL is unavailable the hero falls back to the styled black
   ground with the E₀ caption — quiet failure, never a broken page. */
class SceneBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function HeroScene({ energyRef }) {
  const holderRef = useRef(null)
  const [inView, setInView] = useState(true)
  const [reduced] = useState(prefersReducedMotion)

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

  return (
    <div ref={holderRef} className="hero-scene" aria-hidden="true">
      <SceneBoundary>
        <Suspense fallback={null}>
          <GroundStateScene energyRef={energyRef} reduced={reduced} active={inView} />
        </Suspense>
      </SceneBoundary>
    </div>
  )
}
