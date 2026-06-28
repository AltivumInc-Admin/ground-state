import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Problem from './Problem.jsx'

// Smoke test: the landing sections are the site's primary prerendered surface
// but had no tests. Under the jsdom harness (matchMedia:false) Fx is a no-op,
// so the section renders its static markup — a mount-throw would fail here.
describe('Problem section', () => {
  it('renders its heading and the white-space callout', () => {
    render(
      <MemoryRouter>
        <Problem />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { level: 2, name: /where do you actually talk about it/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/that white space is the ground state society/i)).toBeInTheDocument()
  })
})
