import { useEffect, useState } from 'react'
import { useMotionPaused, setMotionPaused, useReducedMotion } from '../lib/motion.js'

/*
 * The pause/stop mechanism WCAG 2.2.2 asks for, placed beside each
 * auto-animating scene. Hidden under prefers-reduced-motion — the scenes
 * are already static there and the control would be a no-op.
 *
 * Mounts client-only: a media-query-conditional button in prerendered
 * HTML would mismatch on hydration for reduced-motion visitors, and a
 * pause control is dead weight before React boots anyway.
 */
export default function MotionToggle() {
  const paused = useMotionPaused()
  const reduced = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  if (!mounted) return null
  // Hidden under reduced motion — the scenes are already static, so the control
  // would be a no-op. Live via the hook: it appears/disappears if the OS
  // setting flips mid-session.
  if (reduced) return null
  // The visible label already states the action AND the current state
  // ("Resume motion" ⇒ motion is paused). Pairing that with aria-pressed made
  // AT announce contradictory state ("Resume motion … pressed"); the changing
  // label is the clearer of the two canonical patterns, so it carries state
  // alone — and the accessible name always equals the visible text (WCAG 2.5.3).
  return (
    <button
      type="button"
      className="motion-toggle label"
      onClick={() => setMotionPaused(!paused)}
    >
      {paused ? 'Resume motion' : 'Pause motion'}
    </button>
  )
}
