import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Inside from './Inside.jsx'

describe('Inside section', () => {
  it('renders its heading and the three data-driven tiers', () => {
    render(
      <MemoryRouter>
        <Inside />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { level: 2, name: /\$300 a month actually buys/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^The Signal$/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^The Round$/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^Patrons & Partners$/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /apply for membership/i })).toHaveAttribute('href', '/apply')
  })

  it('numbers the stack groups continuously across The Room and The Acceleration', () => {
    render(
      <MemoryRouter>
        <Inside />
      </MemoryRouter>,
    )
    // Acceleration continues at 05 (derived startNum, not restarting at 01) and
    // runs to 09 across 5 items (padStart, no '010'). 04 is skipped here because
    // it also appears as the section kicker.
    expect(screen.getByText('05')).toBeInTheDocument()
    expect(screen.getByText('09')).toBeInTheDocument()
  })
})
