import { useSyncExternalStore } from 'react'

/*
 * Pause-motion store — the WCAG 2.2.2 mechanism for the two perpetually
 * animating scenes (hero cloud, Bloch precession). prefers-reduced-motion
 * already renders them static; this covers everyone else. Persisted so the
 * choice survives reloads.
 */
const KEY = 'gss-motion-paused'

let paused = false
try {
  paused = localStorage.getItem(KEY) === '1'
} catch {
  /* private mode / storage denied — session-only state is fine */
}

const subs = new Set()

/* Mirror the store onto <html> so CSS animations can honor the pause too —
   fig. 03's hν breathe is a CSS keyframe React state can't reach. Guarded:
   the SSR prerender pass has no document. */
function syncDom(v) {
  if (typeof document !== 'undefined') {
    document.documentElement.toggleAttribute('data-motion-paused', v)
  }
}
syncDom(paused) // reflect the persisted choice at boot

export function setMotionPaused(v) {
  paused = v
  try {
    localStorage.setItem(KEY, v ? '1' : '0')
  } catch {
    /* ignore */
  }
  syncDom(v)
  subs.forEach((fn) => fn())
}

const subscribe = (fn) => {
  subs.add(fn)
  return () => subs.delete(fn)
}
const get = () => paused

export function useMotionPaused() {
  return useSyncExternalStore(subscribe, get, () => false)
}

/* True when the visitor's OS asks for reduced motion. Shared by the scene
   wrappers (HeroScene, BlochFigure); SSR-safe — the prerender pass has no
   window, and the static render is the reduced one anyway. */
export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
