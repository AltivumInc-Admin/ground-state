import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../lib/issues.js', () => ({
  getIssueBySlug: (slug) => {
    if (slug === 'first-light')
      return {
        slug: 'first-light',
        title: 'First Light',
        publishedAt: '2026-06-20T00:00:00Z',
        excerpt: 'Teaser.',
        seo: {},
        body: [{ _type: 'block', style: 'normal', _key: '1', markDefs: [], children: [{ _type: 'span', _key: 's', text: 'Hello world', marks: [] }] }],
      }
    // A published-but-sparse issue: null date, empty body, no seo block.
    if (slug === 'sparse') return { slug: 'sparse', title: 'Sparse Issue', publishedAt: null, excerpt: '', seo: {}, body: [] }
    return undefined
  },
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

  it('renders a sparse issue (null date, empty body) without crashing or an empty <time>', () => {
    const { container } = renderAt('/signal/sparse')
    expect(screen.getByRole('heading', { level: 1, name: 'Sparse Issue' })).toBeInTheDocument()
    // No date -> no <time> element (rather than an empty one leaving a gap).
    expect(container.querySelector('time')).toBeNull()
  })
})
