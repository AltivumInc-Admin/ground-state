import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useVtNavigate } from './vt.js'

/* jsdom has no document.startViewTransition, so by default useVtNavigate
   falls through to <Link>'s own navigation. Each VT-path test installs a
   synchronous stub (capture → update → capture is sync in the real API up
   to the animation, which we don't model). */

function Probe() {
  const { pathname } = useLocation()
  return <p data-testid="path">{pathname}</p>
}

function Home({ morph = 'apply-cta' }) {
  const vtNavigate = useVtNavigate()
  return (
    <Link to="/apply" onClick={(e) => vtNavigate(e, '/apply', morph)}>
      Apply
    </Link>
  )
}

function ApplyPage() {
  const vtNavigate = useVtNavigate()
  return (
    <>
      <h1>Apply page</h1>
      <Link to="/apply" onClick={(e) => vtNavigate(e, '/apply', 'apply-cta')}>
        Apply again
      </Link>
    </>
  )
}

const renderApp = (initialPath = '/') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/apply" element={<ApplyPage />} />
      </Routes>
      <Probe />
    </MemoryRouter>,
  )

const path = () => screen.getByTestId('path').textContent

afterEach(() => {
  delete document.startViewTransition
  document.documentElement.removeAttribute('data-motion-paused')
})

describe('useVtNavigate', () => {
  it('wraps the navigation in startViewTransition and lands on the new route', () => {
    document.startViewTransition = vi.fn((cb) => {
      cb()
      return { finished: Promise.resolve() }
    })
    renderApp()
    fireEvent.click(screen.getByRole('link', { name: 'Apply' }))
    expect(document.startViewTransition).toHaveBeenCalledTimes(1)
    expect(path()).toBe('/apply')
  })

  it('marks the clicked element as the morph source, then clears it before the new frame', () => {
    let atOldCapture
    let atNewCapture
    renderApp()
    const link = screen.getByRole('link', { name: 'Apply' })
    document.startViewTransition = (cb) => {
      // Old-frame capture happens synchronously at call time
      atOldCapture = link.style.viewTransitionName
      cb()
      // New-frame capture happens after the update callback
      atNewCapture = link.style.viewTransitionName
      return { finished: Promise.resolve() }
    }
    fireEvent.click(link)
    expect(atOldCapture).toBe('apply-cta')
    // Cleared inside the update — a persistent source (the nav CTA) must not
    // collide with the destination's name in the new frame.
    expect(atNewCapture).toBe('')
  })

  it('falls back to default Link navigation when the API is absent', () => {
    renderApp()
    fireEvent.click(screen.getByRole('link', { name: 'Apply' }))
    expect(path()).toBe('/apply')
  })

  it('defers modified clicks to the browser (no transition, no SPA navigation)', () => {
    document.startViewTransition = vi.fn()
    renderApp()
    fireEvent.click(screen.getByRole('link', { name: 'Apply' }), { metaKey: true })
    expect(document.startViewTransition).not.toHaveBeenCalled()
    expect(path()).toBe('/')
  })

  it('skips the transition under reduced motion — navigation still happens', () => {
    const original = window.matchMedia
    window.matchMedia = (query) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: () => false,
    })
    try {
      document.startViewTransition = vi.fn()
      renderApp()
      fireEvent.click(screen.getByRole('link', { name: 'Apply' }))
      expect(document.startViewTransition).not.toHaveBeenCalled()
      expect(path()).toBe('/apply')
    } finally {
      window.matchMedia = original
    }
  })

  it('skips the transition while the pause toggle is active — navigation still happens', () => {
    document.documentElement.setAttribute('data-motion-paused', '')
    document.startViewTransition = vi.fn()
    renderApp()
    fireEvent.click(screen.getByRole('link', { name: 'Apply' }))
    expect(document.startViewTransition).not.toHaveBeenCalled()
    expect(path()).toBe('/apply')
  })

  it('skips same-route clicks (a re-scroll is not a state change)', () => {
    document.startViewTransition = vi.fn()
    renderApp('/apply')
    fireEvent.click(screen.getByRole('link', { name: 'Apply again' }))
    expect(document.startViewTransition).not.toHaveBeenCalled()
    expect(path()).toBe('/apply')
  })
})
