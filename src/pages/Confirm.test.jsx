import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Endpoint fixed at module-eval (vitest isolates modules per file). The verify
// route is derived from it by swapping the trailing /subscribe segment.
vi.mock('../lib/submit.js', () => ({ postJson: vi.fn(), requestJson: vi.fn() }))
vi.stubEnv('VITE_SIGNAL_ENDPOINT', 'https://api.example.com/subscribe')

const { postJson } = await import('../lib/submit.js')
const { default: Confirm } = await import('./Confirm.jsx')

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Confirm />
    </MemoryRouter>,
  )

afterEach(() => vi.clearAllMocks())

describe('Confirm — double opt-in verify', () => {
  it('POSTs the token to the derived /verify route and confirms', async () => {
    postJson.mockResolvedValueOnce({ ok: true })
    renderAt('/confirm?token=abc123')

    expect(await screen.findByRole('heading', { name: /on The Signal/i })).toBeInTheDocument()
    expect(postJson).toHaveBeenCalledWith('https://api.example.com/verify', { token: 'abc123' })
  })

  it('shows the "expired" copy for a 4xx (terminal) token', async () => {
    postJson.mockRejectedValueOnce(Object.assign(new Error('400'), { status: 400 }))
    renderAt('/confirm?token=used')

    expect(await screen.findByRole('heading', { name: /this link has expired/i })).toBeInTheDocument()
  })

  it('shows a retry — not "expired" — on a transient failure, and retries on click', async () => {
    postJson.mockRejectedValueOnce(new Error('network down')) // no .status → transient
    renderAt('/confirm?token=abc')

    expect(await screen.findByRole('heading', { name: /couldn.t confirm/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /expired/i })).toBeNull()

    postJson.mockResolvedValueOnce({ ok: true })
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByRole('heading', { name: /on The Signal/i })).toBeInTheDocument()
    expect(postJson).toHaveBeenCalledTimes(2)
  })

  it('prompts to open the link when there is no token, and verifies nothing', () => {
    renderAt('/confirm')

    expect(screen.getByRole('heading', { name: /confirm your email/i })).toBeInTheDocument()
    expect(postJson).not.toHaveBeenCalled()
  })

  it('strips the single-use token from the URL once confirmed', async () => {
    const spy = vi.spyOn(window.history, 'replaceState')
    postJson.mockResolvedValueOnce({ ok: true })
    renderAt('/confirm?token=abc')

    await screen.findByRole('heading', { name: /on The Signal/i })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('does not update state after unmount (cancelled guard)', async () => {
    let resolve
    postJson.mockImplementationOnce(() => new Promise((r) => (resolve = r)))
    const { unmount } = renderAt('/confirm?token=abc')
    unmount()
    resolve({ ok: true })
    await Promise.resolve()
    // reaching here without an act()-after-unmount error is the assertion
  })
})
