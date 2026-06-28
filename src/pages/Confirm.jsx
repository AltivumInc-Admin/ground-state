import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Fx from '../lib/fx.jsx'
import usePageMeta from '../lib/usePageMeta.js'
import { postJson } from '../lib/submit.js'

const SIGNAL_ENDPOINT = import.meta.env.VITE_SIGNAL_ENDPOINT

/* Verify shares the subscribe API host. Swap the trailing path segment rather
   than anchoring on the literal "/subscribe" — the old /\/subscribe$/ rewrite
   silently no-ops (POSTing the token back to /subscribe) if the endpoint is ever
   shaped differently. */
function verifyEndpoint(subscribe) {
  if (!subscribe) return ''
  return subscribe.endsWith('/subscribe')
    ? `${subscribe.slice(0, -'/subscribe'.length)}/verify`
    : subscribe.replace(/\/[^/]*$/, '/verify')
}
const VERIFY_ENDPOINT = verifyEndpoint(SIGNAL_ENDPOINT)

// Drop the single-use token from the address bar + history once it's consumed,
// so it isn't left sitting in browser history.
function stripToken() {
  window.history.replaceState(window.history.state, '', window.location.pathname)
}

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
  // confirming | confirmed | invalid | error | unknown
  const [state, setState] = useState(token && VERIFY_ENDPOINT ? 'confirming' : 'unknown')
  // Bumping this re-runs the verify effect (the retry affordance).
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!token || !VERIFY_ENDPOINT) {
      setState('unknown')
      return undefined
    }
    setState('confirming')
    let cancelled = false
    postJson(VERIFY_ENDPOINT, { token })
      .then(() => {
        if (cancelled) return
        setState('confirmed')
        stripToken()
      })
      .catch((err) => {
        if (cancelled) return
        // A 4xx is terminal — the token is genuinely bad / already used / expired.
        // Anything else (network, 5xx, timeout) is transient: let the reader retry
        // rather than telling them a working link has "expired".
        const status = err?.status
        if (status >= 400 && status < 500) {
          setState('invalid')
          stripToken()
        } else {
          setState('error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, attempt])

  return (
    <Fx className="apply-page welcome-page">
      <div className="container">
        {/* Persistent live region — aria-live on a freshly mounted node announces nothing */}
        <div aria-live="polite">
          {state === 'confirming' && (
            <section className="apply-success ground-dark">
              <p className="kicker">
                <strong aria-hidden="true">|0⟩</strong> Confirming
              </p>
              <h1>Confirming your email…</h1>
              <p>One moment.</p>
            </section>
          )}

          {state === 'confirmed' && (
            <section className="apply-success ground-dark" data-fade>
              <p className="kicker">
                <strong aria-hidden="true">|0⟩</strong> Confirmed
              </p>
              <h1>You’re on The Signal.</h1>
              <p>Your email is confirmed. The next briefing will land in the inbox you signed up with.</p>
              <Link to="/" className="btn btn-ghost">
                Return to the page
              </Link>
            </section>
          )}

          {state === 'invalid' && (
            <section className="apply-success ground-dark" data-fade>
              <h1>This link has expired.</h1>
              <p>
                Confirmation links are single-use and expire after a short while. Request a fresh one
                from the page.
              </p>
              <Link to="/#signal" className="btn btn-primary">
                Back to The Signal
              </Link>
            </section>
          )}

          {state === 'error' && (
            <section className="apply-success ground-dark" data-fade>
              <h1>We couldn’t confirm your email just now.</h1>
              <p>
                It’s not you — the confirmation server didn’t answer. Your link is still good; give it
                another try.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setAttempt((n) => n + 1)}
              >
                Try again
                <span className="btn-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            </section>
          )}

          {state === 'unknown' && (
            <section className="apply-success ground-dark" data-fade>
              <h1>Confirm your email.</h1>
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
