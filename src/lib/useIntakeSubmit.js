import { useState } from 'react'
import { postJson } from './submit.js'

/*
 * Shared intake-submit state machine for the postJson-shaped forms (Apply,
 * SignalSubscribe). Owns the idle → sending → sent / preview / error transitions:
 * when `endpoint` is unset the form renders an HONEST preview (nothing is
 * transmitted or stored); otherwise it POSTs the supplied payload. Concurrent
 * submits are guarded — a stray Enter or a lagging disabled state while 'sending'
 * is a no-op. `submit` resolves to the resulting status so the caller can run its
 * own side effects (e.g. scroll-to-top, focus parking).
 *
 * Activate / Welcome / Confirm deliberately do NOT use this: they have a different
 * shape (redirect to Stripe, or GET/POST-verify a URL param), not a
 * fire-and-forget POST.
 */
export default function useIntakeSubmit(endpoint) {
  // idle | sending | sent | preview | error
  const [status, setStatus] = useState('idle')

  async function submit(payload) {
    if (status === 'sending') return status
    if (!endpoint) {
      // Honest preview: the payload is not transmitted or stored.
      setStatus('preview')
      return 'preview'
    }
    setStatus('sending')
    try {
      await postJson(endpoint, payload)
      setStatus('sent')
      return 'sent'
    } catch {
      setStatus('error')
      return 'error'
    }
  }

  return { status, setStatus, submit }
}
