import Hero from '../sections/Hero.jsx'
import Problem from '../sections/Problem.jsx'
import Proof from '../sections/Proof.jsx'
import Inside from '../sections/Inside.jsx'
import FinalCta from '../sections/FinalCta.jsx'
import Fx from '../lib/fx.jsx'
import WaveParticle from '../components/figures/WaveParticle.jsx'
import FigCaption from '../components/figures/FigCaption.jsx'

export default function Landing() {
  return (
    <>
      <Hero />
      <Problem />
      <Fx as="figure" className="fig-divider ground-dark" aria-hidden="false">
        <div className="container">
          {/* The band is the whole moment — the draw spans nearly the
              figure's entire transit across the viewport, and the heavy
              scrub lag means even a fast flick can't rush it: the wave
              plays out over real seconds, watched, never glimpsed */}
          <div
            data-draw
            data-draw-start="top 96%"
            data-draw-end="bottom 22%"
            data-draw-scrub="2.5"
          >
            <WaveParticle />
          </div>
          <FigCaption num="02">
            Wave–particle duality. One system, two true descriptions — a continuous wave, and
            discrete samples of the same curve. Both are the network.
          </FigCaption>
        </div>
      </Fx>
      <Proof />
      <Inside />
      <FinalCta />
    </>
  )
}
