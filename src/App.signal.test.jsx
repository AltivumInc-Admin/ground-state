import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('./lib/issues.js', () => ({
  allIssues: [{ slug: 'first-light', title: 'First Light', publishedAt: '2026-06-20T00:00:00Z', excerpt: '', seo: {}, body: [] }],
  getIssueBySlug: () => undefined,
}))

const { default: App } = await import('./App.jsx')

describe('App routing — /signal', () => {
  it('renders the archive at /signal', () => {
    render(
      <MemoryRouter initialEntries={['/signal']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'The Signal' })).toBeInTheDocument()
  })
})
