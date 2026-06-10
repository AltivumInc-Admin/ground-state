import { Link } from 'react-router-dom'
import Interference from '../components/Interference.jsx'
import FigCaption from '../components/figures/FigCaption.jsx'
import Reveal from '../components/Reveal.jsx'

export default function Hero() {
  return (
    <section id="network" className="hero" aria-labelledby="hero-title">
      <div className="container hero-grid">
        <div>
          <Reveal>
            <p className="hero-eyebrow">Members only · Application required</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 id="hero-title">
              The private network for{' '}
              <span className="accent superposition">funded quantum founders.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="lede">
              The room where the people building the quantum economy share deal flow, hard-won
              lessons, and warm access to capital, customers, and talent.{' '}
              <span className="hero-roi">One warm intro pays for the year.</span>
            </p>
          </Reveal>
          <Reveal delay={0.24}>
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
          </Reveal>
          <Reveal delay={0.32}>
            <p className="hero-meta">
              <span>$300 / month</span>
              <span>Vetted founders only</span>
              <span>Founding cohort now forming</span>
            </p>
          </Reveal>
        </div>
        <Reveal delay={0.2} className="hero-figure" as="figure">
          <Interference />
          <FigCaption num="01" ket="|network⟩ = α|capital⟩ + β|builders⟩">
            Two-source interference. Where coherent waves overlap, amplitude compounds.
          </FigCaption>
        </Reveal>
      </div>
    </section>
  )
}
