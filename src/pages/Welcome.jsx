import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Fx from '../lib/fx.jsx'
import usePageMeta from '../lib/usePageMeta.js'
import { requestJson } from '../lib/submit.js'

const CHECKOUT_ENDPOINT = import.meta.env.VITE_CHECKOUT_ENDPOINT

// The session_id is an unauthenticated bearer for the customer's details (via
// /session). Drop it from the URL/history once the session has been verified.
function stripSession() {
  window.history.replaceState(window.history.state, '', window.location.pathname)
}

/*
 * Stripe sends members here after checkout with ?session_id=cs_...
 * The page verifies the session against the backend before claiming
 * anything — "membership active" is a receipt, not a vibe.
 */
export default function Welcome() {
  usePageMeta({ title: 'Welcome', noindex: true })
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')
  // checking | active | processing | incomplete | error | unknown
  const [state, setState] = useState(sessionId && CHECKOUT_ENDPOINT ? 'checking' : 'unknown')
  const [session, setSession] = useState(null)
  // Bumping this re-runs the verification (the retry affordance).
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!sessionId || !CHECKOUT_ENDPOINT) {
      setState('unknown')
      return undefined
    }
    setState('checking')
    let cancelled = false
    requestJson(`${CHECKOUT_ENDPOINT}/session?session_id=${encodeURIComponent(sessionId)}`)
      .then((s) => {
        if (cancelled) return
        setSession(s)
        if (s.status === 'complete' && s.payment_status === 'paid') setState('active')
        else if (s.status === 'complete') setState('processing')
        else setState('incomplete')
        stripSession()
      })
      .catch(() => {
        // A failed verification is transient — the payment already happened. This
        // is NOT a cold visit, so don't show the same reassurance a no-session
        // visitor gets; let a real member retry. Keep the session_id for the retry.
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, attempt])

  return (
    <Fx className="apply-page welcome-page">
      <div className="container">
        {/* The live region must outlive the state swaps — aria-live on a
            freshly mounted node announces nothing */}
        <div aria-live="polite">
          {state === 'checking' && (
            <section className="apply-success ground-dark">
              <p className="kicker">
                <strong aria-hidden="true">|0⟩</strong> Confirming
              </p>
              <h1>Confirming your membership…</h1>
              <p>One moment — we’re verifying the payment with Stripe.</p>
            </section>
          )}

          {state === 'active' && (
            <section className="apply-success ground-dark welcome-card" data-fade>
              <p className="kicker">
                <strong aria-hidden="true">|0⟩</strong> Membership active
              </p>
              <h1>Welcome to the ground state.</h1>
              <p>
                Your membership in The Round is active
                {session?.plan ? ` — billed ${session.plan === 'annual' ? 'annually' : 'monthly'}` : ''}
                {session?.customer_email ? `, receipt on its way to ${session.customer_email}` : ''}.
              </p>
              <p>
                What happens next is personal, not automated: your peer-circle placement and the
                private channel invite come directly from us. Watch the inbox you applied with.
              </p>
              <Link to="/" className="btn btn-ghost">
                Return to the page
              </Link>
            </section>
          )}

          {state === 'processing' && (
            <section className="apply-success ground-dark" data-fade>
              <p className="kicker">
                <strong aria-hidden="true">|0⟩</strong> Settling
              </p>
              <h1>Payment received — settling.</h1>
              <p>
                Stripe is finishing the payment. Your confirmation and receipt arrive by email
                shortly; nothing more is needed from you.
              </p>
              <Link to="/" className="btn btn-ghost">
                Return to the page
              </Link>
            </section>
          )}

          {state === 'incomplete' && (
            <section className="apply-success ground-dark" data-fade>
              <h1>Checkout wasn’t completed.</h1>
              <p>Nothing was charged. Your seat is still held — pick up where you left off.</p>
              <Link to="/activate" className="btn btn-primary">
                Return to activation
              </Link>
            </section>
          )}

          {state === 'error' && (
            <section className="apply-success ground-dark" data-fade>
              <h1>We couldn’t confirm your membership just now.</h1>
              <p>
                Your payment is safe — this is only the confirmation check. Give it another moment,
                or find the receipt in your email; nothing more is needed from you.
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
              <h1>Welcome.</h1>
              <p>
                If you’ve just completed checkout, your receipt and confirmation arrive by email.
                Circle placement and the channel invite follow personally from us.
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
