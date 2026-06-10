import { useState } from 'react'
import { Link } from 'react-router-dom'
import Reveal from '../components/Reveal.jsx'

const MODALITIES = [
  'Quantum hardware',
  'Quantum software',
  'Quantum sensing',
  'Quantum networking',
  'Post-quantum cryptography',
  'Other / multiple',
]

const STAGES = [
  'Pre-seed (funded)',
  'Seed',
  'Series A',
  'Series B or later',
  'Grant-funded (SBIR / government)',
  'Not yet funded — interested in The Signal',
]

const APPLICANT_TYPES = [
  'Founder / co-founder of a funded quantum startup',
  'Pre-funded founder',
  'Investor',
  'Partner / Patron (sponsorship)',
]

export default function Apply() {
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    // Placeholder: wire to the application backend / form service before launch.
    setSubmitted(true)
    window.scrollTo(0, 0)
  }

  return (
    <div className="apply-page">
      <div className="container">
        <Link to="/" className="back-link">
          <span aria-hidden="true">←</span> Back to the page
        </Link>

        {submitted ? (
          <Reveal className="apply-success" as="section" aria-live="polite">
            <h2>Application received.</h2>
            <p>
              Every application is reviewed personally — you’ll hear from us either way. If the
              room is right for you, the next step is a short conversation.
            </p>
            <Link to="/" className="btn btn-ghost">
              Return to the page
            </Link>
          </Reveal>
        ) : (
          <div className="apply-grid">
            <Reveal className="apply-side" as="aside">
              <h1>Apply to join The Round.</h1>
              <p className="lede">
                The vetted inner circle of The Quantum Collective — for founders and co-founders
                of funded quantum startups.
              </p>
              <ul className="apply-facts">
                <li>$300 / month — founding cohort joins at a locked-in rate</li>
                <li>Every application reviewed personally</li>
                <li>Confidential by agreement and by norm</li>
                <li>Placement in a peer circle matched to your stage and modality</li>
                <li>Not a founder? The Signal is free — no application needed</li>
              </ul>
            </Reveal>

            <Reveal delay={0.1}>
              <form className="apply-form" onSubmit={handleSubmit} aria-label="Membership application">
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="name">Full name</label>
                    <input id="name" name="name" type="text" required autoComplete="name" />
                  </div>
                  <div className="field">
                    <label htmlFor="email">Work email</label>
                    <input id="email" name="email" type="email" required autoComplete="email" />
                  </div>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="company">Company</label>
                    <input id="company" name="company" type="text" required autoComplete="organization" />
                  </div>
                  <div className="field">
                    <label htmlFor="role">Your role</label>
                    <input id="role" name="role" type="text" placeholder="e.g. Co-founder & CEO" required />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="applicant-type">I’m applying as</label>
                  <select id="applicant-type" name="applicantType" required defaultValue="">
                    <option value="" disabled>
                      Select one
                    </option>
                    {APPLICANT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="stage">Funding stage</label>
                    <select id="stage" name="stage" required defaultValue="">
                      <option value="" disabled>
                        Select one
                      </option>
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="modality">Modality</label>
                    <select id="modality" name="modality" required defaultValue="">
                      <option value="" disabled>
                        Select one
                      </option>
                      {MODALITIES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="want">What do you want from the room?</label>
                  <textarea
                    id="want"
                    name="want"
                    placeholder="Capital, customers, talent, peers who get it — tell us plainly."
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary">
                  Submit application
                  <span className="btn-arrow" aria-hidden="true">
                    →
                  </span>
                </button>
                <p className="form-note">
                  Reviewed personally. Confidential. Applying creates no obligation — if the room
                  isn’t right for you, we’ll tell you.
                </p>
              </form>
            </Reveal>
          </div>
        )}
      </div>
    </div>
  )
}
