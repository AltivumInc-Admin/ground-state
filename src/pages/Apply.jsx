import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Fx from '../lib/fx.jsx'
import usePageMeta from '../lib/usePageMeta.js'
import useIntakeSubmit from '../lib/useIntakeSubmit.js'

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
  'Pre-seed',
  'Seed',
  'Series A',
  'Series B or later',
  'Grant-funded (SBIR / government)',
  'Bootstrapped / not yet funded',
]

const APPLICANT_TYPES = [
  'Founder / co-founder of a quantum startup',
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

// Per-field validation copy, keyed by field name. Surfaced via aria-describedby,
// so it is read out when focus lands on the invalid control — not just the one
// generic summary sentence.
const FIELD_ERRORS = {
  name: 'Enter your full name.',
  email: 'Enter a valid work email.',
  company: 'Enter your company.',
  role: 'Enter your role.',
  applicantType: 'Select how you’re applying.',
  stage: 'Select your funding stage.',
  modality: 'Select your modality.',
  want: 'Tell us what you want from the room.',
}

/* Module scope on purpose: a component defined inside render is a new type every
   pass and would remount its <select> on each keystroke, dropping focus. */
function SelectField({ id, name, label, options, value, onChange, error }) {
  const errorId = `${name}-error`
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        name={name}
        required
        value={value}
        onChange={onChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        <option value="" disabled>
          Select one
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default function Apply() {
  usePageMeta({
    title: 'Apply to join The Round',
    description:
      'The application for The Round — the vetted peer network for quantum founders. Reviewed personally.',
  })
  const [form, setForm] = useState(INITIAL_FORM)
  // Honeypot — real users never fill this; bots do. Parity with SignalSubscribe
  // (the subscribe backend already drops a filled `website`).
  const [website, setWebsite] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [invalid, setInvalid] = useState(() => new Set())
  const { status, submit } = useIntakeSubmit(APPLY_ENDPOINT)
  const successRef = useRef(null)
  const errorRef = useRef(null)

  // The form (holding focus on its submit button) unmounts on success — park
  // focus on the confirmation heading so it isn't dropped to <body>. On a failed
  // POST the form stays, so move focus to the recovery message instead.
  useEffect(() => {
    if (status === 'sent' || status === 'preview') successRef.current?.focus()
    else if (status === 'error') errorRef.current?.focus()
  }, [status])

  function update(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    // Once a submit has been attempted, resolve a field's error live as the user
    // fixes it — don't make them resubmit to discover it cleared.
    if (attempted) {
      const ok = e.target.checkValidity()
      setInvalid((prev) => {
        if (ok !== prev.has(name)) return prev // already in the right state
        const next = new Set(prev)
        if (ok) next.delete(name)
        else next.add(name)
        return next
      })
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const formEl = e.currentTarget
    if (!formEl.checkValidity()) {
      setAttempted(true)
      // Iterate the controls (not a `:invalid` selector) so the constraint check
      // runs the same in jsdom and the browser.
      const badEls = Array.from(formEl.elements).filter(
        (el) => el.name && el.willValidate && !el.checkValidity(),
      )
      setInvalid(new Set(badEls.map((el) => el.name)))
      badEls[0]?.focus()
      return
    }
    setAttempted(false)
    setInvalid(new Set())
    const result = await submit({ form: 'apply', ...form, website })
    if (result === 'sent' || result === 'preview') window.scrollTo(0, 0)
  }

  const showForm = status === 'idle' || status === 'sending' || status === 'error'

  // aria-describedby for a text field: any static hint id(s) + its error id when invalid.
  const describe = (name, ...hintIds) => {
    const ids = hintIds.filter(Boolean)
    if (invalid.has(name)) ids.push(`${name}-error`)
    return ids.length ? ids.join(' ') : undefined
  }

  return (
    <Fx className="apply-page">
      <div className="container">
        <Link to="/" className="back-link">
          <span aria-hidden="true">←</span> Back to the page
        </Link>

        {/* The live region must outlive the state swaps — aria-live on a
            freshly mounted node announces nothing (see Welcome.jsx) */}
        <div aria-live="polite">
          {status === 'sent' && (
            <section className="apply-success ground-dark">
              <h1 ref={successRef} tabIndex={-1}>
                Application received.
              </h1>
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
            <section className="apply-success ground-dark">
              <h1 ref={successRef} tabIndex={-1}>
                Application noted — intake opens at launch.
              </h1>
              <p>
                This is a preview build: your application was not transmitted and nothing was
                stored. Founding-cohort intake opens shortly — The Signal will announce it first.
              </p>
              <Link to="/#signal" className="btn btn-ghost">
                Read The Signal — free
              </Link>
            </section>
          )}
        </div>

        {showForm && (
          <div className="apply-grid">
            <aside className="apply-side ground-dark" data-fade>
              <p className="kicker">
                <strong aria-hidden="true">|ψ⟩</strong> Membership application
              </p>
              <h1 id="apply-title">Apply to join The Round.</h1>
              <p className="lede">
                The vetted inner circle of The Ground State Society — for founders and co-founders
                of operating quantum startups, at any funding stage.
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
                aria-labelledby="apply-title"
              >
                <p className="form-required">All fields are required.</p>

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
                      aria-invalid={invalid.has('name') || undefined}
                      aria-describedby={describe('name')}
                    />
                    {invalid.has('name') && (
                      <p id="name-error" className="field-error">
                        {FIELD_ERRORS.name}
                      </p>
                    )}
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
                      value={form.email}
                      onChange={update}
                      aria-invalid={invalid.has('email') || undefined}
                      aria-describedby={describe('email', 'email-hint')}
                    />
                    <p id="email-hint" className="field-hint">
                      Work email — it’s how we verify the company.
                    </p>
                    {invalid.has('email') && (
                      <p id="email-error" className="field-error">
                        {FIELD_ERRORS.email}
                      </p>
                    )}
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
                      aria-invalid={invalid.has('company') || undefined}
                      aria-describedby={describe('company')}
                    />
                    {invalid.has('company') && (
                      <p id="company-error" className="field-error">
                        {FIELD_ERRORS.company}
                      </p>
                    )}
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
                      autoComplete="organization-title"
                      value={form.role}
                      onChange={update}
                      aria-invalid={invalid.has('role') || undefined}
                      aria-describedby={describe('role')}
                    />
                    {invalid.has('role') && (
                      <p id="role-error" className="field-error">
                        {FIELD_ERRORS.role}
                      </p>
                    )}
                  </div>
                </div>

                <SelectField
                  id="applicant-type"
                  name="applicantType"
                  label="I’m applying as"
                  options={APPLICANT_TYPES}
                  value={form.applicantType}
                  onChange={update}
                  error={invalid.has('applicantType') ? FIELD_ERRORS.applicantType : undefined}
                />

                <div className="field-row">
                  <SelectField
                    id="stage"
                    name="stage"
                    label="Funding stage"
                    options={STAGES}
                    value={form.stage}
                    onChange={update}
                    error={invalid.has('stage') ? FIELD_ERRORS.stage : undefined}
                  />
                  <SelectField
                    id="modality"
                    name="modality"
                    label="Modality"
                    options={MODALITIES}
                    value={form.modality}
                    onChange={update}
                    error={invalid.has('modality') ? FIELD_ERRORS.modality : undefined}
                  />
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
                    aria-invalid={invalid.has('want') || undefined}
                    aria-describedby={describe('want')}
                  />
                  {invalid.has('want') && (
                    <p id="want-error" className="field-error">
                      {FIELD_ERRORS.want}
                    </p>
                  )}
                </div>

                {attempted && invalid.size > 0 && (
                  <p className="form-error" role="alert">
                    {invalid.size === 1
                      ? 'One field still needs attention — it’s marked above.'
                      : `${invalid.size} fields still need attention — they’re marked above.`}
                  </p>
                )}

                {status === 'error' && (
                  <p className="form-error" role="alert" ref={errorRef} tabIndex={-1}>
                    Submission didn’t go through — nothing was lost. Try again, or come back
                    shortly.
                  </p>
                )}

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

                <p className="form-note">
                  Reviewed personally. Confidential. Applying creates no obligation — if the room
                  isn’t right for you, we’ll tell you.
                  {!APPLY_ENDPOINT && ' Preview — intake opens at launch.'}
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
    </Fx>
  )
}
