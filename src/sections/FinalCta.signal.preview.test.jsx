import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Separate file so the unset endpoint is fixed at module-eval time (vitest
// isolates modules per file). Empty string => the honest preview branch.
vi.mock('../lib/submit.js', () => ({ postJson: vi.fn(), requestJson: vi.fn() }))
vi.stubEnv('VITE_SIGNAL_ENDPOINT', '')

const { postJson } = await import('../lib/submit.js')
const { SignalForm } = await import('./FinalCta.jsx')

describe('SignalForm — preview when the endpoint is unset', () => {
  it('shows the honest preview and never transmits the address', async () => {
    render(<SignalForm />)
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'founder@quantum.co' },
    })
    fireEvent.click(screen.getByRole('button', { name: /subscribe free/i }))

    expect(await screen.findByText(/store your address/i)).toBeInTheDocument()
    expect(postJson).not.toHaveBeenCalled()
  })
})
