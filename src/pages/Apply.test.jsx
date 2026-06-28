import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Endpoint is read at module-eval, so it is fixed for this whole file (vitest
// isolates modules per file). A configured endpoint exercises the live submit
// path; the unset/preview branch lives in Apply.preview.test.jsx.
vi.mock('../lib/submit.js', () => ({ postJson: vi.fn(), requestJson: vi.fn() }))
vi.stubEnv('VITE_APPLY_ENDPOINT', 'https://api.example.com/apply')

const { postJson } = await import('../lib/submit.js')
const { default: Apply } = await import('./Apply.jsx')

const renderApply = () =>
  render(
    <MemoryRouter>
      <Apply />
    </MemoryRouter>,
  )

const submitBtn = () => screen.getByRole('button', { name: /submit application/i })

const fillValid = () => {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Ada Quantum' } })
  fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'ada@qubit.co' } })
  fireEvent.change(screen.getByLabelText(/^company$/i), { target: { value: 'QubitCo' } })
  fireEvent.change(screen.getByLabelText(/your role/i), { target: { value: 'Co-founder & CEO' } })
  fireEvent.change(screen.getByLabelText(/applying as/i), { target: { value: 'Investor' } })
  fireEvent.change(screen.getByLabelText(/funding stage/i), { target: { value: 'Seed' } })
  fireEvent.change(screen.getByLabelText(/modality/i), { target: { value: 'Quantum software' } })
  fireEvent.change(screen.getByLabelText(/what do you want/i), { target: { value: 'Peers who get it.' } })
}

afterEach(() => vi.clearAllMocks())

describe('Apply — validation feedback', () => {
  it('blocks an empty submit: focuses the first field, marks it invalid, shows the summary, sends nothing', () => {
    renderApply()
    fireEvent.click(submitBtn())

    const name = screen.getByLabelText(/full name/i)
    expect(name).toHaveFocus()
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/work email/i)).toHaveAttribute('aria-invalid', 'true')
    // a per-field message exists and is wired to the control
    expect(screen.getByText('Enter your full name.')).toHaveAttribute('id', 'name-error')
    expect(name).toHaveAttribute('aria-describedby', 'name-error')
    // single summary alert
    expect(screen.getByRole('alert')).toHaveTextContent(/attention/i)
    expect(postJson).not.toHaveBeenCalled()
  })

  it('clears a field error live as the user fixes it (no resubmit needed)', () => {
    renderApply()
    fireEvent.click(submitBtn())
    expect(screen.getByText('Enter your full name.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Ada' } })

    expect(screen.queryByText('Enter your full name.')).toBeNull()
    expect(screen.getByLabelText(/full name/i)).not.toHaveAttribute('aria-invalid')
  })
})

describe('Apply — submission (configured endpoint)', () => {
  it('POSTs the tagged payload (incl. honeypot) and shows the confirmation with focus parked', async () => {
    postJson.mockResolvedValueOnce(true)
    renderApply()
    fillValid()
    fireEvent.click(submitBtn())

    const heading = await screen.findByRole('heading', { name: /application received/i })
    expect(heading).toHaveFocus()
    expect(postJson).toHaveBeenCalledWith(
      'https://api.example.com/apply',
      expect.objectContaining({
        form: 'apply',
        email: 'ada@qubit.co',
        applicantType: 'Investor',
        stage: 'Seed',
        website: '',
      }),
    )
  })

  it('keeps the form and moves focus to the recovery alert on a failed POST', async () => {
    postJson.mockRejectedValueOnce(Object.assign(new Error('500'), { status: 500 }))
    renderApply()
    fillValid()
    fireEvent.click(submitBtn())

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/go through/i)
    expect(alert).toHaveFocus()
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
  })
})
