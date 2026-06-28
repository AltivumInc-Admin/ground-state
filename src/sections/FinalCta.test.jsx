import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// BlochFigure mounts an R3F/WebGL scene that jsdom can't render — stub it; the
// section's own content (heading, steps, CTA, FAQ) is what this smoke test guards.
vi.mock('../components/figures/BlochFigure.jsx', () => ({ default: () => <div data-testid="bloch-stub" /> }))

const { default: FinalCta } = await import('./FinalCta.jsx')

describe('FinalCta section', () => {
  it('renders its heading, the apply CTA, and a FAQ', () => {
    render(
      <MemoryRouter>
        <FinalCta />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { level: 2, name: /you should be in the room/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /apply for membership/i })).toHaveAttribute('href', '/apply')
    expect(screen.getByText(/why pay \$300 a month/i)).toBeInTheDocument()
  })
})
