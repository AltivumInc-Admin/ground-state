import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Endpoint fixed at module-eval (vitest isolates modules per file).
vi.mock('../lib/submit.js', () => ({ postJson: vi.fn(), requestJson: vi.fn() }))
vi.stubEnv('VITE_CHECKOUT_ENDPOINT', 'https://api.example.com')

const { requestJson } = await import('../lib/submit.js')
const { default: Welcome } = await import('./Welcome.jsx')

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Welcome />
    </MemoryRouter>,
  )

afterEach(() => vi.clearAllMocks())

describe('Welcome — post-payment verification', () => {
  it('confirms "active" only when complete + paid, rendering the plan and email', async () => {
    requestJson.mockResolvedValueOnce({
      status: 'complete',
      payment_status: 'paid',
      plan: 'annual',
      customer_email: 'ada@qubit.co',
    })
    renderAt('/welcome?session_id=cs_test_abc')

    expect(
      await screen.findByRole('heading', { name: /welcome to the ground state/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/billed annually/i)).toBeInTheDocument()
    expect(screen.getByText(/ada@qubit\.co/i)).toBeInTheDocument()
    expect(requestJson).toHaveBeenCalledWith(
      'https://api.example.com/session?session_id=cs_test_abc',
    )
  })

  it('shows "settling" when complete but not yet paid', async () => {
    requestJson.mockResolvedValueOnce({ status: 'complete', payment_status: 'unpaid' })
    renderAt('/welcome?session_id=cs_test_x')
    expect(await screen.findByRole('heading', { name: /settling/i })).toBeInTheDocument()
  })

  it('shows "wasn’t completed" for an open session (nothing charged)', async () => {
    requestJson.mockResolvedValueOnce({ status: 'open', payment_status: 'unpaid' })
    renderAt('/welcome?session_id=cs_test_x')
    expect(await screen.findByRole('heading', { name: /wasn.t completed/i })).toBeInTheDocument()
  })

  it('shows a retry — NOT the cold welcome — when verification fails, then retries', async () => {
    requestJson.mockRejectedValueOnce(new Error('network down'))
    renderAt('/welcome?session_id=cs_test_x')

    expect(
      await screen.findByRole('heading', { name: /couldn.t confirm your membership/i }),
    ).toBeInTheDocument()
    // a paid member must not see the cold no-session reassurance
    expect(screen.queryByRole('heading', { name: /^welcome\.?$/i })).toBeNull()

    requestJson.mockResolvedValueOnce({ status: 'complete', payment_status: 'paid' })
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(
      await screen.findByRole('heading', { name: /welcome to the ground state/i }),
    ).toBeInTheDocument()
    expect(requestJson).toHaveBeenCalledTimes(2)
  })

  it('shows the cold welcome and verifies nothing without a session_id', () => {
    renderAt('/welcome')
    expect(screen.getByRole('heading', { name: /^welcome\.?$/i })).toBeInTheDocument()
    expect(requestJson).not.toHaveBeenCalled()
  })

  it('strips the session_id from the URL once verified', async () => {
    const spy = vi.spyOn(window.history, 'replaceState')
    requestJson.mockResolvedValueOnce({ status: 'complete', payment_status: 'paid' })
    renderAt('/welcome?session_id=cs_test_x')

    await screen.findByRole('heading', { name: /welcome to the ground state/i })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
