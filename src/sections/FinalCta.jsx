import { useState } from 'react'
import { Link } from 'react-router-dom'
import Fx from '../lib/fx.jsx'
import BlochFigure from '../components/figures/BlochFigure.jsx'
import FigCaption from '../components/figures/FigCaption.jsx'
import Mosaic from '../components/Mosaic.jsx'
import MotionToggle from '../components/MotionToggle.jsx'
import { postJson } from '../lib/submit.js'

const SIGNAL_ENDPOINT = import.meta.env.VITE_SIGNAL_ENDPOINT

const STEPS = [
  {
    title: 'Apply',
    body: 'A short application: who you are, what you’re building, what you want from the room. Minutes, not hours.',
  },
  {
    title: 'A real conversation',
    body: 'Every application is reviewed personally. We verify that you’re an operating quantum founder — the vetting is the product.',
  },
  {
    title: 'Placement',
    body: 'Accepted members are placed into a peer circle matched by stage and modality, with full access to the network from day one.',
  },
]

const FAQS = [
  {
    q: 'Why pay $300 a month when free quantum communities exist?',
    a: 'Five structural reasons. Curation creates the signal floor open Discords can never reach. Payment creates skin in the game — paying members show up and share real information. Confidentiality is enforced, which makes conversations about burn, down rounds, and disputes possible. Warm capital intros have asymmetric value — one term sheet can return years of fees. And structured peer accountability with founders who actually understand quantum milestones has no free equivalent.',
  },
  {
    q: 'What do I get for bringing another founder in?',
    a: 'A month free. Refer a founder who passes vetting and joins, and your next month’s membership is waived. The network grows by vouching — and vouching is rewarded.',
  },
  {
    q: 'Who qualifies for The Round?',
    a: 'Founders and co-founders of operating quantum startups — across hardware, software, sensing, networking, and post-quantum. Funding stage is not the bar; the vetting is. If you’re building a real quantum company, apply — and The Signal stays free for every quantum builder either way.',
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

export function SignalForm() {
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  // idle | sending | sent | preview | error
  const [status, setStatus] = useState('idle')

  async function handleSubmit(e) {
    e.preventDefault()
    // Guard against concurrent submits: the button is disabled while sending,
    // but a stray Enter or a lagging disabled state must not fire a second POST.
    if (status === 'sending') return
    if (!email.trim()) return
    if (!SIGNAL_ENDPOINT) {
      // Honest preview: the address is not transmitted or stored.
      setStatus('preview')
      return
    }
    setStatus('sending')
    try {
      await postJson(SIGNAL_ENDPOINT, { form: 'signal', email, source: 'signal', website })
      setStatus('sent')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div id="signal" className="signal">
      <div>
        <span className="signal-kicker label">The free tier · No application needed</span>
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
        {/* Persistent live region — role="status" on a freshly mounted node
            announces nothing (see Welcome.jsx) */}
        <div role="status">
          {status === 'sent' && (
            <p className="signal-success">
              <strong>Check your inbox.</strong> Confirm your email and your free access opens right up.
            </p>
          )}
          {status === 'preview' && (
            <p className="signal-success">
              <strong>Noted — The Signal launches with the founding cohort.</strong> This preview
              didn’t store your address; subscription opens at launch.
            </p>
          )}
        </div>
        {(status === 'idle' || status === 'sending' || status === 'error') && (
          <form
            className="signal-form"
            onSubmit={handleSubmit}
            aria-label="Subscribe to The Signal newsletter"
          >
            {/* Honeypot — real users never fill this; bots do. Hidden from AT + tab order. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
            />
            <label className="visually-hidden" htmlFor="signal-email">
              Email address
            </label>
            <input
              id="signal-email"
              type="email"
              required
              placeholder="you@quantumstartup.com"
              autoComplete="email"
              maxLength={320}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn-primary"
              aria-busy={status === 'sending'}
              disabled={status === 'sending'}
            >
              {status === 'sending' ? 'Subscribing…' : 'Subscribe free'}
            </button>
          </form>
        )}
        {status === 'error' && (
          <p className="form-error" role="alert">
            That didn’t go through — try again in a moment.
          </p>
        )}
        <p className="signal-note">
          No spam. No vendor pitches. Unsubscribe anytime.
          {!SIGNAL_ENDPOINT && ' Preview — subscription opens at launch.'}
        </p>
      </div>
    </div>
  )
}

export default function FinalCta() {
  return (
    <Fx as="section" id="join" className="section cta-final ground-dark" aria-labelledby="join-title">
      <Mosaic className="mosaic-corner is-left" cols={8} rows={4} seed={53} />
      <div className="container">
        <div className="cta-head">
          <div>
            <p className="kicker" data-fade>
              <strong>05</strong> The Ask
            </p>
            <h2 id="join-title" className="section-title" data-split>
              If you’re building quantum, you should be in the room.
            </h2>
            <p className="lede" data-fade>
              One action. The founding cohort is forming now — 15–25 vetted quantum founders, by
              application only.
            </p>
          </div>
          <figure className="qfig cta-fig" data-fade>
            <BlochFigure />
            <FigCaption num="04">
              A state holds both answers until it is measured. Applying is the measurement.
              Drag to rotate.
            </FigCaption>
            <MotionToggle />
          </figure>
        </div>

        <div className="cta-steps" data-stagger>
          {STEPS.map((step, i) => (
            <div key={step.title} className="cta-step">
              <span className="step-num label">Step 0{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>

        <div className="cta-actions" data-fade>
          <Link to="/apply" className="btn btn-primary">
            Apply for membership
            <span className="btn-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <p className="aside-note label">$300 / month · Founding rate locked for the first cohort</p>
        </div>

        <div className="faq" data-fade>
          <h3>Fair questions</h3>
          {FAQS.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <p className="faq-body">{item.a}</p>
            </details>
          ))}
        </div>

        <div data-fade>
          <SignalForm />
        </div>
      </div>
    </Fx>
  )
}
