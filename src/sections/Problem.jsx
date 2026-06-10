import Reveal from '../components/Reveal.jsx'

const ALTERNATIVES = [
  {
    tag: 'Open Discords & consortia',
    title: 'Public, by design',
    body: 'Five-thousand-member channels built for students, researchers, and vendors. Uncurated, unvetted, zero confidentiality. You are one stakeholder among many — and you can’t discuss a down round there.',
  },
  {
    tag: 'Accelerators',
    title: 'Over in months',
    body: 'Excellent while they last — then the cohort disperses. Time-limited, gated by stage and geography, and there is no room to come back to.',
  },
  {
    tag: 'Generalist founder networks',
    title: 'Nobody speaks qubits',
    body: 'Hampton, EO, and YPO have the peer structure — at $500–$830+ a month — but your “peer group” is a SaaS CEO and a real-estate operator. No quantum capital network, no grant literacy, no domain depth.',
  },
  {
    tag: 'Conferences',
    title: 'Once a year, no follow-up',
    body: 'Q2B, IEEE Quantum Week, APS March Meeting: high-density, episodic, public. The hallway conversation ends when the badge comes off.',
  },
]

export default function Problem() {
  return (
    <section id="problem" className="section" aria-labelledby="problem-title">
      <span className="ghost-num" aria-hidden="true">
        04
      </span>
      <div className="container">
        <Reveal>
          <p className="kicker">
            <strong>04</strong> The Problem
          </p>
          <h2 id="problem-title" className="section-title">
            You run a funded quantum company. Where do you actually talk about it?
          </h2>
          <p className="lede">
            Quantum is small and competitive. Founders chase the same customers, watch the same
            agencies, and recruit from the same scarce talent pool. The conversations that matter
            — burn rate, a down round, a churned pilot, a co-founder dispute — cannot happen in
            public.
          </p>
        </Reveal>

        <div className="problem-grid">
          {ALTERNATIVES.map((alt, i) => (
            <Reveal key={alt.tag} className="problem-card" delay={i * 0.07} as="article">
              <span className="card-tag">{alt.tag}</span>
              <h3>{alt.title}</h3>
              <p>{alt.body}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="whitespace-callout">
          <p>
            No one offers a curated, confidential, ongoing peer network exclusively for operating
            quantum founders. <strong>That white space is The Quantum Collective.</strong>
          </p>
        </Reveal>
      </div>
    </section>
  )
}
