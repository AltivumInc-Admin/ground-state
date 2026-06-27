import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Endpoint is read at module-eval, so it is fixed for this whole file (vitest
// isolates modules per file). A configured endpoint exercises the live submit
// path; the unset/preview branch lives in SignalSubscribe.preview.test.jsx.
vi.mock('../lib/submit.js', () => ({ postJson: vi.fn(), requestJson: vi.fn() }))
vi.stubEnv('VITE_SIGNAL_ENDPOINT', 'https://api.example.com/subscribe')

const { postJson } = await import('../lib/submit.js')
const { default: SignalSubscribe } = await import('./SignalSubscribe.jsx')

const fillEmail = (value) =>
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value } })

afterEach(() => vi.clearAllMocks())

describe('SignalSubscribe — configured endpoint', () => {
  it('goes idle → sending → sent and transmits the source-tagged payload', async () => {
    postJson.mockResolvedValueOnce(true)
    render(<SignalSubscribe />)
    fillEmail('founder@quantum.co')
    fireEvent.click(screen.getByRole('button', { name: /subscribe free/i }))

    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument()
    expect(postJson).toHaveBeenCalledWith(
      'https://api.example.com/subscribe',
      expect.objectContaining({ form: 'signal', email: 'founder@quantum.co', source: 'signal' }),
    )
    // the form is replaced by the success state — no path to resubmit
    expect(screen.queryByRole('button', { name: /subscribe/i })).toBeNull()
  })

  it('surfaces a recoverable error and preserves the entered email on failure', async () => {
    postJson.mockRejectedValueOnce(new Error('Intake endpoint responded 502'))
    render(<SignalSubscribe />)
    fillEmail('founder@quantum.co')
    fireEvent.click(screen.getByRole('button', { name: /subscribe free/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/go through/i)
    // form still present with the email intact → the user just resubmits
    expect(screen.getByLabelText(/email address/i)).toHaveValue('founder@quantum.co')
  })

  it('disables the control while sending and blocks a concurrent second submit', async () => {
    let resolvePost
    postJson.mockImplementationOnce(() => new Promise((resolve) => (resolvePost = resolve)))
    render(<SignalSubscribe />)
    fillEmail('founder@quantum.co')

    const form = screen.getByLabelText(/subscribe to the signal/i)
    fireEvent.click(screen.getByRole('button', { name: /subscribe free/i }))

    // in-flight: button reports busy + disabled
    const busyBtn = await screen.findByRole('button', { name: /subscribing/i })
    expect(busyBtn).toBeDisabled()
    expect(busyBtn).toHaveAttribute('aria-busy', 'true')

    // a stray second submit while sending must not fire a second POST
    fireEvent.submit(form)
    expect(postJson).toHaveBeenCalledTimes(1)

    resolvePost(true)
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument()
  })

  it('does not transmit an empty email and keeps the honeypot out of AT + tab order', () => {
    render(<SignalSubscribe />)
    const email = screen.getByLabelText(/email address/i)
    expect(email).toBeRequired()

    fireEvent.submit(screen.getByLabelText(/subscribe to the signal/i))
    expect(postJson).not.toHaveBeenCalled()

    const honeypot = document.querySelector('input[name="website"]')
    expect(honeypot).toHaveAttribute('aria-hidden', 'true')
    expect(honeypot).toHaveAttribute('tabindex', '-1')
  })
})
