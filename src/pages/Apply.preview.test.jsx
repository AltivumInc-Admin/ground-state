import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Separate file so the unset endpoint is fixed at module-eval time (vitest
// isolates modules per file). Empty string => the honest preview branch.
vi.mock('../lib/submit.js', () => ({ postJson: vi.fn(), requestJson: vi.fn() }))
vi.stubEnv('VITE_APPLY_ENDPOINT', '')

const { postJson } = await import('../lib/submit.js')
const { default: Apply } = await import('./Apply.jsx')

const renderApply = () =>
  render(
    <MemoryRouter>
      <Apply />
    </MemoryRouter>,
  )

describe('Apply — preview when the endpoint is unset', () => {
  it('shows the honest preview and transmits nothing once the form validates', async () => {
    renderApply()
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Ada Quantum' } })
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'ada@qubit.co' } })
    fireEvent.change(screen.getByLabelText(/^company$/i), { target: { value: 'QubitCo' } })
    fireEvent.change(screen.getByLabelText(/your role/i), { target: { value: 'CEO' } })
    fireEvent.change(screen.getByLabelText(/applying as/i), { target: { value: 'Investor' } })
    fireEvent.change(screen.getByLabelText(/funding stage/i), { target: { value: 'Seed' } })
    fireEvent.change(screen.getByLabelText(/modality/i), { target: { value: 'Quantum software' } })
    fireEvent.change(screen.getByLabelText(/what do you want/i), { target: { value: 'Peers.' } })
    fireEvent.click(screen.getByRole('button', { name: /submit application/i }))

    expect(await screen.findByText(/intake opens at launch/i)).toBeInTheDocument()
    expect(postJson).not.toHaveBeenCalled()
  })
})
