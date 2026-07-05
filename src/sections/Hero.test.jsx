import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

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

describe('Hero quantized transition', () => {
  afterEach(() => {
    delete document.startViewTransition
  })

  it('the Apply CTA navigates inside a view transition when the API exists', () => {
    document.startViewTransition = vi.fn((cb) => {
      cb()
      return { finished: Promise.resolve() }
    })
    render(
      <MemoryRouter>
        <Routes>
          <Route path="*" element={<Hero />} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('link', { name: /apply for membership/i }))
    expect(document.startViewTransition).toHaveBeenCalledTimes(1)
  })
})
