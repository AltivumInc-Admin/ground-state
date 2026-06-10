import { useState } from 'react'
import { Link } from 'react-router-dom'
import Fx from '../lib/fx.jsx'
import { postJson } from '../lib/submit.js'

const APPLY_ENDPOINT = import.meta.env.VITE_APPLY_ENDPOINT

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

const INITIAL_FORM = {
  name: '',
  email: '',
  company: '',
  role: '',
  applicantType: '',
  stage: '',
  modality: '',
  want: '',
}

export default function Apply() {
  const [form, setForm] = useState(INITIAL_FORM)
  // idle | sending | sent | preview | error
  const [status, setStatus] = useState('idle')
  const [attempted, setAttempted] = useState(false)

  // The Round is for funded founders — self-identified pre-funded
  // applicants are routed to the free Signal tier instead of the paywall.
  const preFunded =
    form.applicantType === 'Pre-funded founder' ||
    form.stage === 'Not yet funded — interested in The Signal'

  function update(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!e.target.checkValidity()) {
      setAttempted(true)
      e.target.querySelector(':invalid')?.focus()
      return
    }
    setAttempted(false)
    if (!APPLY_ENDPOINT) {
      // Honest preview: nothing is transmitted or stored.
      setStatus('preview')
      window.scrollTo(0, 0)
      return
    }
    setStatus('sending')
    try {
      await postJson(APPLY_ENDPOINT, { form: 'apply', ...form })
      setStatus('sent')
      window.scrollTo(0, 0)
    } catch {
      setStatus('error')
    }
  }

  const showForm = status === 'idle' || status === 'sending' || status === 'error'

  return (
    <Fx className="apply-page">
      <div className="container">
        <Link to="/" className="back-link">
          <span aria-hidden="true">←</span> Back to the page
        </Link>

        {status === 'sent' && (
          <section className="apply-success ground-dark" aria-live="polite" data-fade>
            <h2>Application received.</h2>
            <p>
              Every application is reviewed personally — you’ll hear from us either way. If the
              room is right for you, the next step is a short conversation.
            </p>
            <Link to="/" className="btn btn-ghost">
              Return to the page
            </Link>
          </section>
        )}

        {status === 'preview' && (
          <section className="apply-success ground-dark" aria-live="polite" data-fade>
            <h2>Application noted — intake opens at launch.</h2>
            <p>
              This is a preview build: your application was not transmitted and nothing was
              stored. Founding-cohort intake opens shortly — The Signal will announce it first.
            </p>
            <Link to="/#signal" className="btn btn-ghost">
              Read The Signal — free
            </Link>
          </section>
        )}

        {showForm && (
          <div className="apply-grid">
            <aside className="apply-side ground-dark" data-fade>
              <h1>Apply to join The Round.</h1>
              <p className="lede">
                The vetted inner circle of The Ground State Society — for founders and co-founders
                of funded quantum startups.
              </p>
              <ul className="apply-facts">
                <li>$300 / month — founding cohort joins at a locked-in rate</li>
                <li>Every application reviewed personally</li>
                <li>Confidential by agreement and by norm</li>
                <li>Placement in a peer circle matched to your stage and modality</li>
                <li>Not a founder? The Signal is free — no application needed</li>
              </ul>
            </aside>

            <div data-fade>
              <form
                className={`apply-form${attempted ? ' was-validated' : ''}`}
                onSubmit={handleSubmit}
                noValidate
                aria-label="Membership application"
              >
                <div className="field-row">
                  <div className="field">
                    <label htmlFor="name">Full name</label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      maxLength={200}
                      autoComplete="name"
                      value={form.name}
                      onChange={update}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="email">Work email</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      maxLength={320}
                      autoComplete="email"
                      aria-describedby="email-hint"
                      value={form.email}
                      onChange={update}
                    />
                    <p id="email-hint" className="field-hint">
                      Work email — it’s how we verify the company.
                    </p>
                  </div>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="company">Company</label>
                    <input
                      id="company"
                      name="company"
                      type="text"
                      required
                      maxLength={200}
                      autoComplete="organization"
                      value={form.company}
                      onChange={update}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="role">Your role</label>
                    <input
                      id="role"
                      name="role"
                      type="text"
                      placeholder="e.g. Co-founder & CEO"
                      required
                      maxLength={200}
                      value={form.role}
                      onChange={update}
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="applicant-type">I’m applying as</label>
                  <select
                    id="applicant-type"
                    name="applicantType"
                    required
                    value={form.applicantType}
                    onChange={update}
                  >
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
                    <select id="stage" name="stage" required value={form.stage} onChange={update}>
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
                    <select
                      id="modality"
                      name="modality"
                      required
                      value={form.modality}
                      onChange={update}
                    >
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
                    maxLength={2000}
                    value={form.want}
                    onChange={update}
                  />
                </div>

                {attempted && (
                  <p className="form-error" role="alert">
                    A few fields still need attention — they’re marked above.
                  </p>
                )}

                {status === 'error' && (
                  <p className="form-error" role="alert">
                    Submission didn’t go through — nothing was lost. Try again, or come back
                    shortly.
                  </p>
                )}

                {preFunded ? (
                  <div className="route-note">
                    <p>
                      <strong>The Round is for funded founders — but you’re early, not out.</strong>{' '}
                      Start free in The Signal; we’ll convert you the day you raise.
                    </p>
                    <Link to="/#signal" className="btn btn-primary">
                      Join The Signal — free
                    </Link>
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    aria-busy={status === 'sending'}
                    disabled={status === 'sending'}
                  >
                    {status === 'sending' ? 'Submitting…' : 'Submit application'}
                    {status !== 'sending' && (
                      <span className="btn-arrow" aria-hidden="true">
                        →
                      </span>
                    )}
                  </button>
                )}

                <p className="form-note">
                  Reviewed personally. Confidential. Applying creates no obligation — if the room
                  isn’t right for you, we’ll tell you.
                  {!APPLY_ENDPOINT && !preFunded && ' Preview — intake opens at launch.'}
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
    </Fx>
  )
}
