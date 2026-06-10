import Hero from '../sections/Hero.jsx'
import Problem from '../sections/Problem.jsx'
import Story from '../sections/Story.jsx'
import Proof from '../sections/Proof.jsx'
import Inside from '../sections/Inside.jsx'
import FinalCta from '../sections/FinalCta.jsx'
import Reveal from '../components/Reveal.jsx'
import WaveParticle from '../components/figures/WaveParticle.jsx'
import FigCaption from '../components/figures/FigCaption.jsx'

export default function Landing() {
  return (
    <>
      <Hero />
      <Problem />
      <Story />
      <Reveal as="figure" className="fig-divider" aria-hidden="false">
        <div className="container">
          <WaveParticle />
          <FigCaption num="02">
            Wave–particle duality. One system, two true descriptions — a continuous wave, and
            discrete events sampling it. Both are the network.
          </FigCaption>
        </div>
      </Reveal>
      <Proof />
      <Inside />
      <FinalCta />
    </>
  )
}
