import { useEffect, useRef } from 'react'
import { gsap } from '../lib/gsap-core.js'

/*
 * Cursor companion — a measurement reticle. Four corner ticks ride
 * with the native cursor (which stays visible) as a small frame; over
 * anything interactive they spring out and lock onto the element's
 * bounds, like a viewfinder acquiring its subject.
 * Fine pointers only; never under prefers-reduced-motion.
 */
const IDLE = 22 // idle frame size, px
const PAD = 7 // breathing room around an acquired target

const HOT = 'a, button, summary, input, select, textarea, [data-tilt], .bloch3d'

export default function Cursor() {
  const ref = useRef(null)

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const el = ref.current
    if (!el) return undefined

    el.style.display = 'block'
    const qx = gsap.quickTo(el, 'x', { duration: 0.3, ease: 'power3' })
    const qy = gsap.quickTo(el, 'y', { duration: 0.3, ease: 'power3' })
    const qw = gsap.quickTo(el, 'width', { duration: 0.35, ease: 'power3' })
    const qh = gsap.quickTo(el, 'height', { duration: 0.35, ease: 'power3' })

    let target = null // the element currently framed
    let shown = false

    const frame = (t) => {
      const r = t.getBoundingClientRect()
      qx(r.left - PAD)
      qy(r.top - PAD)
      qw(r.width + PAD * 2)
      qh(r.height + PAD * 2)
    }

    const move = (e) => {
      if (!shown) {
        shown = true
        gsap.set(el, { x: e.clientX - IDLE / 2, y: e.clientY - IDLE / 2 })
        gsap.to(el, { opacity: 0.45, duration: 0.3, overwrite: 'auto' })
      }
      if (!target) {
        qx(e.clientX - IDLE / 2)
        qy(e.clientY - IDLE / 2)
      }
    }

    const over = (e) => {
      const hot = e.target.closest?.(HOT)
      if (hot === target) return
      target = hot
      if (hot) {
        frame(hot)
        gsap.to(el, { opacity: 0.85, duration: 0.25, overwrite: 'auto' })
      } else {
        qw(IDLE)
        qh(IDLE)
        qx(e.clientX - IDLE / 2)
        qy(e.clientY - IDLE / 2)
        gsap.to(el, { opacity: 0.45, duration: 0.25, overwrite: 'auto' })
      }
    }

    // Keep the frame locked to its subject while the page scrolls under it
    const onScroll = () => {
      if (target) frame(target)
    }

    const leaveDoc = () => gsap.to(el, { opacity: 0, duration: 0.3, overwrite: 'auto' })
    const enterDoc = () => gsap.to(el, { opacity: target ? 0.85 : 0.45, duration: 0.3, overwrite: 'auto' })

    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerover', over, true)
    window.addEventListener('scroll', onScroll, { passive: true })
    document.documentElement.addEventListener('pointerleave', leaveDoc)
    document.documentElement.addEventListener('pointerenter', enterDoc)
    return () => {
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerover', over, true)
      window.removeEventListener('scroll', onScroll)
      document.documentElement.removeEventListener('pointerleave', leaveDoc)
      document.documentElement.removeEventListener('pointerenter', enterDoc)
    }
  }, [])

  return (
    <span ref={ref} className="cursor-reticle" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}
