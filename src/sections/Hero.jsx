import { useRef } from 'react'
import { Link } from 'react-router-dom'
import HeroScene from '../components/HeroScene.jsx'
import MotionToggle from '../components/MotionToggle.jsx'
import { gsap, ScrollTrigger, useGSAP, MOTION_OK } from '../lib/gsap-core.js'

export default function Hero() {
  const sectionRef = useRef(null)
  // 0 = ground state, 1 = excited. The scroll scrub writes here;
  // the particle cloud reads it every frame.
  const energyRef = useRef(0)

  useGSAP(
    () => {
      // Prerendered first paint: the wordmark is already on screen —
      // replaying the entrance would hide what the visitor has read.
      // Read-and-clear, so client-side returns to / still animate.
      const root = document.getElementById('root')
      const prerendered = root?.dataset.prerendered === 'true'
      if (prerendered) delete root.dataset.prerendered

      const mm = gsap.matchMedia()

      mm.add(MOTION_OK, () => {
        if (!prerendered) {
          // Load: the bento assembles, then the wordmark lines rise.
          gsap
            .timeline({ defaults: { ease: 'power3.out' } })
            .from('.bx', { autoAlpha: 0, y: 18, duration: 0.8, stagger: 0.09 }, 0.15)
            .from(
              '.wm-line',
              { yPercent: 110, duration: 1.1, stagger: 0.14, ease: 'power4.out' },
              0.5,
            )
        }

        // No pin, no zoom — the bento scrolls away naturally, but
        // scrolling still injects energy into the cloud (the caption
        // promises "scroll perturbs it"); it relaxes when you return.
        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom 25%',
          onUpdate: (self) => {
            energyRef.current = self.progress * 0.75
          },
        })
        return undefined
      })
    },
    { scope: sectionRef },
  )

  return (
    <section
      id="network"
      ref={sectionRef}
      className="hero ground-dark"
      aria-labelledby="hero-title"
    >
      <div className="hero-frame container">
        <div className="hero-bento">
          <p className="bx bx-label label">
            Members only
            <br />
            Application required
          </p>
          <p className="bx bx-label bx-label-right label" aria-hidden="true">
            |0⟩ — the lowest-energy state
            <br />
            Stable by construction
          </p>

          <h1 id="hero-title" className="bx bx-wordmark hero-wordmark" aria-label="The Ground State Society">
            <span className="wm-row" aria-hidden="true">
              <span className="wm-line">
                <em className="wm-the">The</em> Ground
              </span>
            </span>
            <span className="wm-row" aria-hidden="true">
              <span className="wm-line">State Society</span>
            </span>
          </h1>

          <div className="bx bx-scene">
            <HeroScene energyRef={energyRef} />
            <p className="scene-ket label" aria-hidden="true">
              |society⟩ = α|capital⟩ + β|builders⟩
            </p>
            <p className="scene-caption label" aria-hidden="true">
              fig. 01 — relaxation to the ground state. E₀ = ½ħω: even settled, the cloud
              never freezes. Scroll perturbs it.
            </p>
            <MotionToggle />
          </div>

          <div className="bx bx-side">
            <p className="hero-lede">
              The private network for quantum founders. The room where the people
              building the quantum economy share deal flow, hard-won lessons, and warm access
              to capital, customers, and talent.{' '}
              <strong className="hero-roi">Refer a founder who joins — take a month free.</strong>
            </p>
            <div className="hero-actions">
              <Link to="/apply" className="btn btn-primary">
                Apply for membership
                <span className="btn-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
              <Link to="/#signal" className="btn btn-ghost">
                Get The Signal — free
              </Link>
            </div>
          </div>

          <p className="bx bx-meta hero-meta label">
            <span>$300 / month</span>
            <span>Vetted founders only</span>
            <span>Founding cohort forming</span>
          </p>
        </div>
      </div>
    </section>
  )
}
