import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import BlochSphere from './BlochSphere.jsx'
import SceneBoundary from '../SceneBoundary.jsx'
import { useReducedMotion, useMotionPaused } from '../../lib/motion.js'

/* fig. 07 goes live where it can: the 3D precessing Bloch sphere.
   The accurate SVG remains the figure under prefers-reduced-motion,
   without WebGL, or if the scene ever fails. */
const BlochScene = lazy(() => import('../../three/BlochScene.jsx'))

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export default function BlochFigure() {
  const holderRef = useRef(null)
  const yawRef = useRef(0)
  const draggingRef = useRef(false)
  // Live reduced-motion: a mid-session OS 'Reduce motion' flip reverts the
  // scene to the accurate SVG immediately. SSR-safe (snapshot false); the SVG
  // still shows during hydration because `webgl` starts false and gates
  // showScene, so prerendered HTML and the first client render agree.
  const reduced = useReducedMotion()
  const [webgl, setWebgl] = useState(false)
  // A lost WebGL context (DOM event, not a throw) also reverts to the SVG.
  const [lost, setLost] = useState(false)
  useEffect(() => {
    setWebgl(hasWebGL())
  }, [])
  // Pause toggle swaps to the scientifically accurate static SVG
  const paused = useMotionPaused()
  const [near, setNear] = useState(false) // mount the scene only as it approaches
  const [inView, setInView] = useState(true) // stop the loop off-screen

  // Pausing unmounts the holder div, so the observers must re-attach when
  // the scene path returns — a mount-only effect would leave `near` frozen
  // and the figure permanently empty after pause → resume.
  const showScene = !reduced && !paused && webgl && !lost

  useEffect(() => {
    const node = holderRef.current
    if (!node) return undefined // SVG fallback rendered — nothing to observe
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return undefined
    }
    const nearObs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true)
          nearObs.disconnect()
        }
      },
      { rootMargin: '600px 0px' },
    )
    const liveObs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      rootMargin: '80px 0px',
    })
    nearObs.observe(node)
    liveObs.observe(node)
    return () => {
      nearObs.disconnect()
      liveObs.disconnect()
    }
  }, [showScene])

  if (!showScene) return <BlochSphere />

  const down = (e) => {
    draggingRef.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const move = (e) => {
    if (draggingRef.current) yawRef.current += e.movementX * 0.006
  }
  const up = () => {
    draggingRef.current = false
  }

  // The accessible name carries no pointer-only affordance — the visible
  // FigCaption says "Drag to rotate" for those who can drag.
  return (
    <div
      ref={holderRef}
      className="bloch3d"
      role="img"
      aria-label="Bloch sphere: the state vector precesses between ket zero and ket one."
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
    >
      <span className="b3-ket label" aria-hidden="true">
        |0⟩
      </span>
      {near && (
        <SceneBoundary fallback={<BlochSphere />}>
          {/* While the lazy chunk downloads, the accurate SVG stands in —
              never a blank cell between the labels. */}
          <Suspense fallback={<BlochSphere />}>
            <BlochScene
              yawRef={yawRef}
              draggingRef={draggingRef}
              active={inView}
              onContextLost={() => setLost(true)}
            />
          </Suspense>
        </SceneBoundary>
      )}
      <span className="b3-ket b3-bottom label" aria-hidden="true">
        |1⟩
      </span>
    </div>
  )
}
