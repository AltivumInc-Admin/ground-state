import { gsap } from './gsap-core.js'
import { prefersReducedMotion } from './motion.js'

/*
 * Magnetic buttons — every .btn leans a few pixels toward the cursor
 * and springs back on leave. Delegated, so buttons that mount later
 * (route changes, form states) get the behavior for free. Fine
 * pointers only; never under prefers-reduced-motion.
 */
export function initMagnetic() {
  if (typeof window === 'undefined') return
  if (!window.matchMedia('(pointer: fine)').matches) return
  if (prefersReducedMotion()) return

  const STRENGTH = 0.22

  document.addEventListener('pointerover', (e) => {
    const btn = e.target.closest?.('.btn')
    if (!btn || btn.dataset.magnet) return
    btn.dataset.magnet = '1'
    const xTo = gsap.quickTo(btn, 'x', { duration: 0.45, ease: 'power3' })
    const yTo = gsap.quickTo(btn, 'y', { duration: 0.45, ease: 'power3' })
    // Measure once at rest: the button is at/near identity transform on entry,
    // and the pull is relative to its home centre. Re-reading the rect every
    // pointermove forced a reflow each frame AND fed the in-progress transform
    // back into the maths (a subtle wobble); this closes over the resting rect.
    const r = btn.getBoundingClientRect()
    const move = (ev) => {
      xTo((ev.clientX - r.left - r.width / 2) * STRENGTH)
      yTo((ev.clientY - r.top - r.height / 2) * STRENGTH)
    }
    const leave = () => {
      xTo(0)
      yTo(0)
      btn.removeEventListener('pointermove', move)
      btn.removeEventListener('pointerleave', leave)
      delete btn.dataset.magnet
    }
    btn.addEventListener('pointermove', move)
    btn.addEventListener('pointerleave', leave)
  })
}
