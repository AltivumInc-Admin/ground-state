import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// CHECKOUT_ENDPOINT is read at module scope, so the env must be stubbed BEFORE
// the component is imported. No vi.resetModules() — React stays a single shared
// instance with @testing-library/react (avoids "invalid hook call").
vi.stubEnv('VITE_CHECKOUT_ENDPOINT', 'https://api.example.com')
const { default: Activate } = await import('./Activate.jsx')

const realFetch = globalThis.fetch
let assign

beforeEach(() => {
  assign = vi.fn()
  // jsdom throws on navigation — replace location with a spyable stub.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign, href: 'http://localhost/' },
  })
})

afterEach(() => {
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

const renderActivate = () =>
  render(
    <MemoryRouter>
      <Activate />
    </MemoryRouter>,
  )

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: /continue to secure checkout/i }))

describe('Activate — the live payment trigger', () => {
  it('POSTs {plan} to /checkout and redirects to the returned Stripe URL', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ url: 'https://checkout.stripe.com/c/pay/abc' }),
    }))
    renderActivate()
    fireEvent.click(screen.getByRole('radio', { name: /annual/i }))
    submit()

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/abc'),
    )
    const [url, opts] = globalThis.fetch.mock.calls[0]
    expect(url).toBe('https://api.example.com/checkout')
    expect(JSON.parse(opts.body)).toEqual({ plan: 'annual' })
  })

  it('rejects a non-Stripe URL without navigating (open-redirect guard)', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ url: 'https://evil.example.com/' }),
    }))
    renderActivate()
    submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/nothing was charged/i)
    expect(assign).not.toHaveBeenCalled()
  })

  it('renders the error state when the checkout request fails', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) }))
    renderActivate()
    submit()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/nothing was charged/i)
    expect(assign).not.toHaveBeenCalled()
  })
})
