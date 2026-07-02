import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// HeroScene mounts an R3F/WebGL Canvas that jsdom can't render — stub it so the
// test exercises the hero wordmark and CTAs, not the 3D scene.
vi.mock('../components/figures/HeroScene.jsx', () => ({ default: () => <div data-testid="hero-scene-stub" /> }))

const { default: Hero } = await import('./Hero.jsx')

describe('Hero section', () => {
  it('renders the wordmark heading and both CTAs', () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'The Ground State Society' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /apply for membership/i })).toHaveAttribute('href', '/apply')
    expect(screen.getByRole('link', { name: /get the signal/i })).toHaveAttribute('href', '/#signal')
  })
})
