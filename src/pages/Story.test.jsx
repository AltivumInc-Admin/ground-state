import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import StoryPage from './Story.jsx'

describe('Story page', () => {
  it('renders the narrative and both CTAs', () => {
    render(
      <MemoryRouter>
        <StoryPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: /built by an operator/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /apply for membership/i })).toHaveAttribute('href', '/apply')
    expect(screen.getByRole('link', { name: /go to the home page/i })).toHaveAttribute('href', '/')
  })

  it('uses h2 (not h3) for the panel subheadings — correct outline under the page h1', () => {
    render(
      <MemoryRouter>
        <StoryPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 2, name: /real today/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /founding-member deal/i })).toBeInTheDocument()
  })
})
