import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../lib/issues.js', () => ({
  getIssueBySlug: (slug) =>
    slug === 'first-light'
      ? {
          slug: 'first-light',
          title: 'First Light',
          publishedAt: '2026-06-20T00:00:00Z',
          excerpt: 'Teaser.',
          seo: {},
          body: [{ _type: 'block', style: 'normal', _key: '1', markDefs: [], children: [{ _type: 'span', _key: 's', text: 'Hello world', marks: [] }] }],
        }
      : undefined,
}))

const { default: SignalIssue } = await import('./SignalIssue.jsx')

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/signal/:slug" element={<SignalIssue />} />
        <Route path="/signal" element={<div>archive index</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SignalIssue page', () => {
  it('renders the issue title and body for a known slug', () => {
    renderAt('/signal/first-light')
    expect(screen.getByRole('heading', { level: 1, name: 'First Light' })).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('redirects to the archive for an unknown slug', () => {
    renderAt('/signal/does-not-exist')
    expect(screen.getByText('archive index')).toBeInTheDocument()
  })
})
