import { useEffect, useRef, useState } from 'react'
import useIntakeSubmit from '../lib/useIntakeSubmit.js'

const SIGNAL_ENDPOINT = import.meta.env.VITE_SIGNAL_ENDPOINT

/*
 * The Signal's free-tier capture, shared across the landing CTA and the Signal
 * archive / issue pages. Copy is passed in so each surface speaks in its own
 * context; the form mechanics (idle → sending → sent / preview / error, the
 * honeypot, the concurrent-submit guard, the transport) are identical everywhere.
 */
export default function SignalSubscribe({ id, kicker, heading, blurb }) {
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  // idle → sending → sent / preview / error, plus the concurrent-submit and
  // honest-preview guards, all live in the shared hook.
  const { status, submit } = useIntakeSubmit(SIGNAL_ENDPOINT)
  const fieldId = `${id || 'signal'}-email`
  const successRef = useRef(null)

  // Park focus on the confirmation when the form unmounts on success, so focus
  // isn't dropped to <body> (matches Apply).
  useEffect(() => {
    if (status === 'sent' || status === 'preview') successRef.current?.focus()
  }, [status])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    await submit({ form: 'signal', email, source: 'signal', website })
  }

  return (
    <div id={id} className="signal">
      <div>
        {kicker ? <span className="signal-kicker label">{kicker}</span> : null}
        {heading ? <h3>{heading}</h3> : null}
        {blurb ? <p>{blurb}</p> : null}
      </div>
      <div>
        {/* Persistent live region — role="status" on a freshly mounted node
            announces nothing (see Welcome.jsx) */}
        <div role="status">
          {status === 'sent' && (
            <p className="signal-success" ref={successRef} tabIndex={-1}>
              <strong>Check your inbox.</strong> Confirm your email and your free access opens right up.
            </p>
          )}
          {status === 'preview' && (
            <p className="signal-success" ref={successRef} tabIndex={-1}>
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
            <label className="visually-hidden" htmlFor={fieldId}>
              Email address
            </label>
            <input
              id={fieldId}
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
              {status !== 'sending' && (
                <span className="btn-arrow" aria-hidden="true">
                  →
                </span>
              )}
            </button>
          </form>
        )}
        {/* Persistent assertive region — present before the swap so the error
            reliably announces (a bare role="alert" mounted only on error is a
            freshly-mounted live region). */}
        <div role="alert" className="signal-alert">
          {status === 'error' && (
            <p className="form-error">
              That didn’t go through — nothing was lost. Try again in a moment.
            </p>
          )}
        </div>
        <p className="signal-note">
          No spam. No vendor pitches. Unsubscribe anytime.
          {!SIGNAL_ENDPOINT && ' Preview — subscription opens at launch.'}
        </p>
      </div>
    </div>
  )
}
