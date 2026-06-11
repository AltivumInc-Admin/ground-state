import Fx from '../lib/fx.jsx'

const ALTERNATIVES = [
  {
    num: '01',
    tag: 'Open Discords & consortia',
    title: 'Public, by design',
    body: 'Five-thousand-member channels built for students, researchers, and vendors. Uncurated, unvetted, zero confidentiality. You are one stakeholder among many — and you can’t discuss a down round there.',
  },
  {
    num: '02',
    tag: 'Accelerators',
    title: 'Over in months',
    body: 'Excellent while they last — then the cohort disperses. Time-limited, gated by stage and geography, and there is no room to come back to.',
  },
  {
    num: '03',
    tag: 'Generalist founder networks',
    title: 'Nobody speaks qubits',
    body: 'Hampton, EO, and YPO have the peer structure — at $500–$833+ a month — but your “peer group” is a SaaS CEO and a real-estate operator. No quantum capital network, no grant literacy, no domain depth.',
  },
  {
    num: '04',
    tag: 'Conferences',
    title: 'Once a year, no follow-up',
    body: 'Q2B, IEEE Quantum Week, APS March Meeting: high-density, episodic, public. The hallway conversation ends when the badge comes off.',
  },
]

export default function Problem() {
  return (
    <Fx as="section" id="problem" className="section" aria-labelledby="problem-title">
      <div className="container">
        <p className="kicker" data-fade>
          <strong>02</strong> The Problem
        </p>
        <h2 id="problem-title" className="section-title" data-split>
          You run a quantum company. Where do you actually talk about it?
        </h2>
        <p className="lede" data-fade>
          Quantum is small and competitive. Founders chase the same customers, watch the same
          agencies, and recruit from the same scarce talent pool. The conversations that matter
          — burn rate, a down round, a churned pilot, a co-founder dispute — cannot happen in
          public.
        </p>

        <div className="problem-grid" data-stagger>
          {ALTERNATIVES.map((alt) => (
            <article key={alt.tag} className="problem-card">
              <span className="card-num label">{alt.num}</span>
              <span className="card-tag label">{alt.tag}</span>
              <h3>{alt.title}</h3>
              <p>{alt.body}</p>
            </article>
          ))}
        </div>

        <div className="whitespace-callout ground-dark" data-fade>
          <span className="callout-mark label" aria-hidden="true">
            ∅ — the white space
          </span>
          <p>
            No one offers a curated, confidential, ongoing peer network exclusively for
            operating quantum founders. <strong>That white space is The Ground State Society.</strong>
          </p>
        </div>
      </div>
    </Fx>
  )
}
