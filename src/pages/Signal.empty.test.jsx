import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// The empty archive is the LIVE render today (issues.generated.json is []), so
// guard it explicitly — a separate file to mock allIssues as empty without
// fighting the populated mock in Signal.test.jsx.
vi.mock('../lib/issues.js', () => ({ allIssues: [] }))

const { default: Signal } = await import('./Signal.jsx')

describe('Signal archive index — empty state', () => {
  it('shows the "first issue on its way" copy and still offers the subscribe form', () => {
    render(
      <MemoryRouter>
        <Signal />
      </MemoryRouter>,
    )
    expect(screen.getByText(/the first issue is on its way/i)).toBeInTheDocument()
    // No issue links, but the free-tier capture is still present.
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /subscribe free/i })).toBeInTheDocument()
  })
})
