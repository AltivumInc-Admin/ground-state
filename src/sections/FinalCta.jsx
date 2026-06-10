import { useState } from 'react'
import { Link } from 'react-router-dom'
import Reveal from '../components/Reveal.jsx'
import BlochSphere from '../components/figures/BlochSphere.jsx'
import FigCaption from '../components/figures/FigCaption.jsx'

const STEPS = [
  {
    title: 'Apply',
    body: 'A short application: who you are, what you’re building, what you want from the room. Minutes, not hours.',
  },
  {
    title: 'A real conversation',
    body: 'Every application is reviewed personally. We verify that you’re an operating founder of a funded quantum company — the vetting is the product.',
  },
  {
    title: 'Placement',
    body: 'Accepted members are placed into a peer circle matched by stage and modality, with full access to the network from day one.',
  },
]

const FAQS = [
  {
    q: 'Why pay $300 a month when free quantum communities exist?',
    a: 'Five structural reasons. Curation creates the signal floor open Discords can never reach. Payment creates skin in the game — paying members show up and share real information. Confidentiality is enforced, which makes conversations about burn, down rounds, and disputes possible. Warm capital intros have asymmetric value — one term sheet returns years of fees. And structured peer accountability with founders who actually understand quantum milestones has no free equivalent.',
  },
  {
    q: 'Who qualifies for The Round?',
    a: 'Founders and co-founders of venture-funded, operating quantum startups — across hardware, software, sensing, networking, and post-quantum. Pre-funded founders start free in The Signal, and we convert them the day they raise.',
  },
  {
    q: 'I’m an engineer, researcher, or investor. Is there a place for me?',
    a: 'Yes — The Signal is free and open to every quantum builder: the newsletter, public webinars, and the open community channel. Investors and ecosystem allies participate through the Patrons & Partners tier — valuable to the network, never seated inside the confidential peer circles.',
  },
  {
    q: 'How confidential is it, really?',
    a: 'A plain-language member agreement is required at join, and peer circles run under enforced, Chatham House-style norms. Quantum is small and competitive — confidentiality isn’t a feature of the product, it is the product.',
  },
  {
    q: 'Can I expense it?',
    a: 'Most members can. At $3,600 a year, membership costs less than a single conference trip with travel — and quantum founders typically spend $3,000–$10,000 a year on the circuit.',
  },
  {
    q: 'What does the founding cohort get?',
    a: 'A locked-in founding rate that never goes up, a permanent founding badge, and a real hand in shaping the network. Early members are helping build the room they’re paying for — the terms acknowledge that.',
  },
]

function SignalForm() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (email.trim()) setDone(true)
  }

  return (
    <div id="signal" className="signal">
      <div>
        <span className="signal-kicker">The free tier · No application needed</span>
        <h3>
          Not ready for the Round? <em>Read The Signal.</em>
        </h3>
        <p>
          The free briefing for quantum builders — funding moves, ecosystem intelligence, and
          what quantum founders are actually wrestling with. For founders, engineers,
          researchers, and students alike.
        </p>
      </div>
      <div>
        {done ? (
          <p className="signal-success" role="status">
            <strong>You’re in.</strong> The next issue of The Signal will land in your inbox.
          </p>
        ) : (
          <form className="signal-form" onSubmit={handleSubmit} aria-label="Subscribe to The Signal newsletter">
            <label className="visually-hidden" htmlFor="signal-email">
              Email address
            </label>
            <input
              id="signal-email"
              type="email"
              required
              placeholder="you@quantumstartup.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="btn btn-on-dark">
              Subscribe free
            </button>
          </form>
        )}
        <p className="signal-note">No spam. No vendor pitches. Unsubscribe anytime.</p>
      </div>
    </div>
  )
}

export default function FinalCta() {
  return (
    <section id="join" className="section cta-final" aria-labelledby="join-title">
      <span className="ghost-num" aria-hidden="true">
        08
      </span>
      <div className="container">
        <div className="cta-head">
          <Reveal>
            <p className="kicker">
              <strong>08</strong> The Ask
            </p>
            <h2 id="join-title" className="section-title">
              If you’re building quantum, you should be in the room.
            </h2>
            <p className="lede">
              One action. The founding cohort is forming now — 15–25 funded quantum founders, by
              application only.
            </p>
          </Reveal>
          <Reveal as="figure" className="qfig cta-fig" delay={0.15}>
            <BlochSphere />
            <FigCaption num="04">
              A state holds both answers until it is measured. Applying is the measurement.
            </FigCaption>
          </Reveal>
        </div>

        <div className="cta-steps">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} className="cta-step" delay={i * 0.08}>
              <span className="step-num">Step 0{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="cta-actions">
          <Link to="/apply" className="btn btn-primary">
            Apply for membership
            <span className="btn-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <p className="aside-note">$300 / month · Founding rate locked for the first cohort</p>
        </Reveal>

        <Reveal className="faq">
          <h3>Fair questions</h3>
          {FAQS.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <p className="faq-body">{item.a}</p>
            </details>
          ))}
        </Reveal>

        <Reveal>
          <SignalForm />
        </Reveal>
      </div>
    </section>
  )
}
