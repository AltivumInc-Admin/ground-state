import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Fx from '../lib/fx.jsx'
import usePageMeta from '../lib/usePageMeta.js'
import { postJson } from '../lib/submit.js'

const SIGNAL_ENDPOINT = import.meta.env.VITE_SIGNAL_ENDPOINT
// The verify route lives alongside /subscribe on the same API.
const VERIFY_ENDPOINT = SIGNAL_ENDPOINT ? SIGNAL_ENDPOINT.replace(/\/subscribe$/, '/verify') : ''

/*
 * The Signal confirmation landing. The double-opt-in magic link points here
 * with ?token=...; we POST it to /verify to confirm the address. Confirming is
 * all the free tier needs — the bearer token the backend returns is for the
 * quantum module's gate, not used here.
 */
export default function Confirm() {
  usePageMeta({ title: 'Confirm your email', noindex: true })
  const [params] = useSearchParams()
  const token = params.get('token')
  // confirming | confirmed | invalid | unknown
  const [state, setState] = useState(token && VERIFY_ENDPOINT ? 'confirming' : 'unknown')

  useEffect(() => {
    if (!token || !VERIFY_ENDPOINT) {
      setState('unknown')
      return undefined
    }
    setState('confirming')
    let cancelled = false
    postJson(VERIFY_ENDPOINT, { token })
      .then(() => {
        if (!cancelled) setState('confirmed')
      })
      .catch(() => {
        if (!cancelled) setState('invalid')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <Fx className="apply-page welcome-page">
      <div className="container">
        {/* Persistent live region — aria-live on a freshly mounted node announces nothing */}
        <div aria-live="polite">
          {state === 'confirming' && (
            <section className="apply-success ground-dark">
              <p className="kicker">
                <strong>|0⟩</strong> Confirming
              </p>
              <h2>Confirming your email…</h2>
              <p>One moment.</p>
            </section>
          )}

          {state === 'confirmed' && (
            <section className="apply-success ground-dark" data-fade>
              <p className="kicker">
                <strong>|0⟩</strong> Confirmed
              </p>
              <h2>You’re on The Signal.</h2>
              <p>Your email is confirmed. The next briefing will land in the inbox you signed up with.</p>
              <Link to="/" className="btn btn-ghost">
                Return to the page
              </Link>
            </section>
          )}

          {state === 'invalid' && (
            <section className="apply-success ground-dark" data-fade>
              <h2>This link has expired.</h2>
              <p>
                Confirmation links are single-use and expire after a short while. Request a fresh one
                from the page.
              </p>
              <Link to="/#signal" className="btn btn-primary">
                Back to The Signal
              </Link>
            </section>
          )}

          {state === 'unknown' && (
            <section className="apply-success ground-dark" data-fade>
              <h2>Confirm your email.</h2>
              <p>
                Open the confirmation link from the email we sent to finish signing up for The Signal.
              </p>
              <Link to="/" className="btn btn-ghost">
                Return to the page
              </Link>
            </section>
          )}
        </div>
      </div>
    </Fx>
  )
}
