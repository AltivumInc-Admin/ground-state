import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Separate file so the unset endpoint is fixed at module-eval time (vitest
// isolates modules per file). Empty string => the honest preview branch.
vi.stubEnv('VITE_CHECKOUT_ENDPOINT', '')
const { default: Activate } = await import('./Activate.jsx')

describe('Activate — preview state when checkout is not configured', () => {
  it('renders the honest preview and no billing form', () => {
    render(
      <MemoryRouter>
        <Activate />
      </MemoryRouter>,
    )
    expect(screen.getByText(/activation opens with your acceptance/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /continue to secure checkout/i }),
    ).toBeNull()
  })
})
