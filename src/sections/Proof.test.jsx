import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Proof from './Proof.jsx'

describe('Proof section', () => {
  it('renders its heading, a stat, and the comparison table', () => {
    render(
      <MemoryRouter>
        <Proof />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 2, name: /receipts, not vibes/i })).toBeInTheDocument()
    // A stat fallback value (rendered statically; the counter only runs under motion).
    expect(screen.getByText('$4.1B')).toBeInTheDocument()
    // The comparison table lists the priced peer networks.
    expect(screen.getByText('Hampton')).toBeInTheDocument()
  })
})
