import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/issues.js', () => ({
  allIssues: [
    { slug: 'first-light', title: 'First Light', publishedAt: '2026-06-20T00:00:00Z', excerpt: 'Teaser one.', seo: {}, body: [] },
  ],
}))

const { default: Signal } = await import('./Signal.jsx')

describe('Signal archive index', () => {
  it('lists published issues as links to their pages', () => {
    render(
      <MemoryRouter>
        <Signal />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: /first light/i })
    expect(link).toHaveAttribute('href', '/signal/first-light')
    expect(screen.getByText('Teaser one.')).toBeInTheDocument()
  })
})
