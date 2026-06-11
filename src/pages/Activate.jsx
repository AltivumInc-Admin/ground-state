import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Fx from '../lib/fx.jsx'
import { requestJson } from '../lib/submit.js'

const CHECKOUT_ENDPOINT = import.meta.env.VITE_CHECKOUT_ENDPOINT

/*
 * Membership activation — the step after a yes. This page is deliberately
 * unlinked from the landing page and nav: the URL travels only in
 * acceptance emails. Cold visitors who land here are routed to /apply.
 */
const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '$300',
    per: '/ month',
    note: 'Founding-cohort rate, locked in for as long as you stay.',
  },
  {
    id: 'annual',
    name: 'Annual',
    price: '$3,600',
    per: '/ year',
    note: 'One invoice — the simplest thing to expense.',
  },
]

export default function Activate() {
  const [plan, setPlan] = useState('monthly')
  // idle | redirecting | error
  const [status, setStatus] = useState('idle')

  // Back from Stripe can restore this page from the bfcache mid-'redirecting',
  // which would leave the button disabled forever
  useEffect(() => {
    const onPageShow = (e) => {
      if (e.persisted) setStatus('idle')
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!CHECKOUT_ENDPOINT) return
    setStatus('redirecting')
    try {
      const { url } = await requestJson(`${CHECKOUT_ENDPOINT}/checkout`, { plan })
      if (!/^https:\/\/checkout\.stripe\.com\//.test(url)) throw new Error('unexpected URL')
      window.location.assign(url)
    } catch {
      setStatus('error')
    }
  }

  return (
    <Fx className="apply-page activate-page">
      <div className="container">
        <Link to="/" className="back-link">
          <span aria-hidden="true">←</span> Back to the page
        </Link>

        <div className="apply-grid">
          <aside className="apply-side ground-dark" data-fade>
            <p className="kicker">
              <strong>Δ</strong> Membership activation
            </p>
            <h1>Take your seat in the Round.</h1>
            <p className="lede">
              You applied, we talked, and the answer is yes. One decision remains — how the
              membership is billed — and then the room is yours.
            </p>
            <ul className="apply-facts">
              <li>Same membership either way — billing is the only difference</li>
              <li>Refer a founder who joins and your next month is free</li>
              <li>Cancel any time; no lock-in beyond the period you chose</li>
              <li>Your card statement reads GROUNDSTATESOCIETY.COM</li>
            </ul>
          </aside>

          <div data-fade>
            {CHECKOUT_ENDPOINT ? (
              <form className="activate-form" onSubmit={handleSubmit} aria-label="Choose billing">
                <fieldset className="plan-choice">
                  <legend className="label">Two discrete states — choose one</legend>
                  {PLANS.map((p) => (
                    <label
                      key={p.id}
                      className={`plan-card${plan === p.id ? ' is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={p.id}
                        checked={plan === p.id}
                        onChange={() => setPlan(p.id)}
                        className="visually-hidden"
                      />
                      <span className="plan-name label">{p.name}</span>
                      <span className="plan-price">
                        {p.price}
                        <small>{p.per}</small>
                      </span>
                      <span className="plan-note">{p.note}</span>
                    </label>
                  ))}
                </fieldset>

                {status === 'error' && (
                  <p className="form-error" role="alert">
                    Checkout didn’t open — nothing was charged. Try again, or reply to your
                    acceptance email and we’ll sort it personally.
                  </p>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  aria-busy={status === 'redirecting'}
                  disabled={status === 'redirecting'}
                >
                  {status === 'redirecting' ? 'Opening secure checkout…' : 'Continue to secure checkout'}
                  {status !== 'redirecting' && (
                    <span className="btn-arrow" aria-hidden="true">
                      →
                    </span>
                  )}
                </button>

                <p className="form-note">
                  Payment is handled by Stripe — your card never touches our servers. Here
                  without an acceptance? The room is entered by application:{' '}
                  <Link to="/apply">apply to join The Round</Link>.
                </p>
              </form>
            ) : (
              <section className="apply-success ground-dark" aria-live="polite">
                <h2>Activation opens with your acceptance.</h2>
                <p>
                  This is a preview build — checkout is not yet connected. Accepted founders
                  receive a personal activation link by email when intake opens.
                </p>
                <Link to="/apply" className="btn btn-ghost">
                  Apply to join The Round
                </Link>
              </section>
            )}
          </div>
        </div>
      </div>
    </Fx>
  )
}
