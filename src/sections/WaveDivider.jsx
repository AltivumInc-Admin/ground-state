import Fx from '../lib/fx.jsx'
import WaveParticle from '../components/figures/WaveParticle.jsx'
import FigCaption from '../components/figures/FigCaption.jsx'

// The wave–particle figure divider between the Problem and Proof sections.
// Extracted from Landing so the page composer stays a clean list of sections;
// every other figure on the site likewise lives inside its own component.
export default function WaveDivider() {
  return (
    <Fx as="figure" className="fig-divider ground-dark" aria-hidden="false">
      <div className="container">
        {/* The band is the whole moment — the draw spans nearly the
            figure's entire transit across the viewport, and the heavy
            scrub lag means even a fast flick can't rush it: the wave
            plays out over real seconds, watched, never glimpsed */}
        <div data-draw data-draw-start="top 96%" data-draw-end="bottom 22%" data-draw-scrub="2.5">
          <WaveParticle />
        </div>
        <FigCaption num="02">
          Wave–particle duality. One system, two true descriptions — a continuous wave, and
          discrete samples of the same curve. Both are the network.
        </FigCaption>
      </div>
    </Fx>
  )
}
