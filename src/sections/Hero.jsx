import { useRef } from 'react'
import { Link } from 'react-router-dom'
import HeroScene from '../components/HeroScene.jsx'
import { gsap, useGSAP, MOTION_OK } from '../lib/fx.jsx'

export default function Hero() {
  const sectionRef = useRef(null)
  // 0 = ground state, 1 = fully excited. The scroll scrub writes here;
  // the particle cloud reads it every frame.
  const energyRef = useRef(0)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        // Load: the page settles in, like the cloud behind it.
        const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
        intro
          .from('.hero-topline > *', { autoAlpha: 0, y: -12, duration: 0.7, stagger: 0.1 }, 0.2)
          .from(
            '.wm-line',
            { yPercent: 110, duration: 1.1, stagger: 0.14, ease: 'power4.out' },
            0.35,
          )
          .from(
            ['.hero-lede', '.hero-actions', '.hero-meta'],
            { autoAlpha: 0, y: 26, duration: 0.9, stagger: 0.12 },
            0.9,
          )
          .from('.hero-caption, .hero-cue', { autoAlpha: 0, duration: 0.9 }, 1.5)

        return undefined
      })

      // Pin: scrolling injects energy — the cloud excites and the
      // composition lifts away. Releasing lets it relax back to E₀.
      // Desktop only: pinning a 100svh section on small screens fights
      // mobile browser chrome.
      mm.add(`${MOTION_OK} and (min-width: 769px)`, () => {
        gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: '+=80%',
            scrub: 0.7,
            pin: true,
            anticipatePin: 1,
            onUpdate: (self) => {
              energyRef.current = self.progress * 0.9
            },
          },
        })
          .to('.hero-content', { yPercent: -14, autoAlpha: 0, ease: 'none' }, 0)
          .to('.hero-topline, .hero-caption, .hero-cue', { autoAlpha: 0, ease: 'none' }, 0)
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
      <HeroScene energyRef={energyRef} />

      <div className="hero-frame container">
        <div className="hero-topline label">
          <p>
            Members only
            <br />
            Application required
          </p>
          <p className="hero-topline-right">
            |0⟩ — the lowest-energy state
            <br />
            Stable by construction
          </p>
        </div>

        <div className="hero-content">
          <h1 id="hero-title" className="hero-wordmark" aria-label="The Ground State Society">
            <span className="wm-row" aria-hidden="true">
              <span className="wm-line">
                <em className="wm-the">The</em> Ground
              </span>
            </span>
            <span className="wm-row" aria-hidden="true">
              <span className="wm-line">State Society</span>
            </span>
          </h1>

          <div className="hero-side">
            <p className="hero-lede">
              The private network for funded quantum founders. The room where the people
              building the quantum economy share deal flow, hard-won lessons, and warm access
              to capital, customers, and talent.{' '}
              <strong className="hero-roi">One warm intro pays for the year.</strong>
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
            <p className="hero-meta label">
              <span>$300 / month</span>
              <span>Vetted founders only</span>
              <span>Founding cohort forming</span>
            </p>
          </div>
        </div>

        <div className="hero-caption label" aria-hidden="true">
          <p>
            fig. 01 — relaxation to the ground state. E₀ = ½ħω: even settled, the cloud
            never freezes.
          </p>
          <p className="hero-ket">|society⟩ = α|capital⟩ + β|builders⟩</p>
        </div>

        <div className="hero-cue label" aria-hidden="true">
          <span>Scroll</span>
          <span className="hero-cue-line" />
        </div>
      </div>
    </section>
  )
}
