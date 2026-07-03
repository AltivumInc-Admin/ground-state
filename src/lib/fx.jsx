import { useRef } from 'react'
import { gsap, useGSAP, MOTION_OK } from './gsap-core.js'

/* SplitText + DrawSVGPlugin are heavy choreography plugins used only by the
   landing and story routes. They are imported dynamically inside the motion
   path below (not statically here), so Rollup keeps them in a runtime async
   chunk instead of the eager, preloaded gsap chunk — the routes that never
   animate (/signal, /apply, /activate, /welcome, /confirm) never fetch them. */

/*
 * Fx — declarative scroll choreography for a section.
 * Wrap a section and annotate descendants:
 *   data-split            display title: per-line mask reveal
 *   data-fade             fade-rise on enter
 *   data-stagger          children fade-rise, staggered
 *   data-draw             SVG line art draws in, scrubbed by scroll
 *   data-count + data-prefix/data-suffix/data-decimals
 *                          numeric counter (markup holds the final
 *                          formatted value for the static fallback)
 */
export default function Fx({ as: Tag = 'div', className, children, ...rest }) {
  const ref = useRef(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        const scope = ref.current
        if (!scope) return

        scope.querySelectorAll('[data-fade]').forEach((el) => {
          gsap.from(el, {
            autoAlpha: 0,
            y: 28,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          })
        })

        scope.querySelectorAll('[data-stagger]').forEach((el) => {
          gsap.from(el.children, {
            autoAlpha: 0,
            y: 30,
            duration: 0.85,
            stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          })
        })

        scope.querySelectorAll('[data-cells]').forEach((el) => {
          gsap.from(el.children, {
            autoAlpha: 0,
            duration: 0.45,
            ease: 'none',
            stagger: { each: 0.018, from: 'random' },
            scrollTrigger: { trigger: el, start: 'top 92%', once: true },
          })
        })

        // Decorative mosaics drift slightly against the scroll
        scope.querySelectorAll('.mosaic').forEach((el) => {
          gsap.fromTo(
            el,
            { yPercent: -8 },
            {
              yPercent: 10,
              ease: 'none',
              scrollTrigger: {
                trigger: el.parentElement,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 0.5,
              },
            },
          )
        })

        scope.querySelectorAll('[data-count]').forEach((el) => {
          const end = parseFloat(el.dataset.count)
          if (Number.isNaN(end)) return
          const decimals = parseInt(el.dataset.decimals || '0', 10)
          const prefix = el.dataset.prefix || ''
          const suffix = el.dataset.suffix || ''
          const state = { n: 0 }
          gsap.to(state, {
            n: end,
            duration: 1.6,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 85%', once: true },
            onUpdate() {
              el.textContent = `${prefix}${state.n.toFixed(decimals)}${suffix}`
            },
          })
        })

        // SplitText + DrawSVGPlugin are loaded here on demand, so routes
        // without [data-split]/[data-draw] never fetch them. We're already
        // inside the motion-OK branch, so a gsap.context (not another
        // matchMedia) collects the async tweens for teardown.
        const splitEls = scope.querySelectorAll('[data-split]')
        const drawEls = scope.querySelectorAll('[data-draw]')
        if (!splitEls.length && !drawEls.length) return

        let cancelled = false
        let pluginCtx
        Promise.all([import('gsap/SplitText'), import('gsap/DrawSVGPlugin')]).then(
          ([{ SplitText }, { DrawSVGPlugin }]) => {
            // Unmounted (or media flipped) before the import resolved — don't
            // build tweens into a dead scope.
            if (cancelled || !ref.current) return
            gsap.registerPlugin(SplitText, DrawSVGPlugin)
            pluginCtx = gsap.context(() => {
              splitEls.forEach((el) => {
                SplitText.create(el, {
                  type: 'lines',
                  mask: 'lines',
                  autoSplit: true,
                  onSplit: (split) =>
                    gsap.from(split.lines, {
                      yPercent: 112,
                      duration: 0.85,
                      stagger: 0.09,
                      ease: 'power3.out',
                      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
                    }),
                })
              })

              drawEls.forEach((el) => {
                const shapes = [...el.querySelectorAll('path, line, circle, ellipse, polyline')]
                if (!shapes.length) return
                const scrub = parseFloat(el.dataset.drawScrub)
                // Stroked shapes draw in; fill-only shapes (the particle dots)
                // materialize afterwards, one by one — wave first, then its
                // discrete samples. One bucketing pass: getComputedStyle is a
                // forced style resolution, so resolve each shape once.
                const drawables = []
                const dots = []
                shapes.forEach((s) => {
                  ;(getComputedStyle(s).stroke !== 'none' ? drawables : dots).push(s)
                })
                const tl = gsap.timeline({
                  scrollTrigger: {
                    trigger: el,
                    start: el.dataset.drawStart || 'top 90%',
                    end: el.dataset.drawEnd || 'top 25%',
                    // Higher scrub = more lag behind the scrollbar; a flick
                    // can't rush the draw, it plays out over real seconds.
                    scrub: Number.isFinite(scrub) ? scrub : 1,
                  },
                })
                if (drawables.length) {
                  tl.from(drawables, { drawSVG: 0, stagger: 0.04, ease: 'none', duration: 1 })
                }
                if (dots.length) {
                  tl.from(
                    dots,
                    { autoAlpha: 0, stagger: 0.07, duration: 0.4, ease: 'none' },
                    drawables.length ? '-=0.25' : 0,
                  )
                }
              })
            }, scope)
          },
        )

        // matchMedia revert (incl. useGSAP unmount) runs this — tear down the
        // async tweens, which live outside useGSAP's own auto-context.
        return () => {
          cancelled = true
          pluginCtx?.revert()
        }
      })

      // Pointer tilt — fine pointers only, a few degrees, springs back
      mm.add(`${MOTION_OK} and (pointer: fine)`, () => {
        const removers = []
        ref.current?.querySelectorAll('[data-tilt]').forEach((el) => {
          gsap.set(el, { transformPerspective: 900 })
          const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' })
          const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' })
          const move = (ev) => {
            const r = el.getBoundingClientRect()
            rx(((ev.clientY - r.top) / r.height - 0.5) * -5)
            ry(((ev.clientX - r.left) / r.width - 0.5) * 6)
          }
          const leave = () => {
            rx(0)
            ry(0)
          }
          el.addEventListener('pointermove', move)
          el.addEventListener('pointerleave', leave)
          removers.push(() => {
            el.removeEventListener('pointermove', move)
            el.removeEventListener('pointerleave', leave)
          })
        })
        return () => removers.forEach((r) => r())
      })
    },
    { scope: ref },
  )

  return (
    <Tag ref={ref} className={className} {...rest}>
      {children}
    </Tag>
  )
}
