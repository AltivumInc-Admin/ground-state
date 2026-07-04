import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Nav from './Nav.jsx'

/* The mobile menu is a fullscreen overlay, so it must behave as a modal:
   Escape closes + restores focus, Tab is contained to the header, the page
   behind goes inert, the body scroll locks. jsdom's matchMedia stub defaults
   matches:false, so override it per-test to put us at the overlay breakpoint
   (≤1240px) while keeping GSAP's reduced-motion gate inert. */

const setViewport = (isMobile) => {
  window.matchMedia = (query) => ({
    matches: query.includes('max-width: 1240px') ? isMobile : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => false,
  })
}

// A page tree so Nav can find the siblings it makes inert.
const renderNav = () =>
  render(
    <MemoryRouter>
      <Nav />
      <main id="main">page</main>
      <footer>foot</footer>
    </MemoryRouter>,
  )

const toggle = () => screen.getByRole('button', { name: /menu|close/i })

afterEach(() => {
  document.body.style.overflow = ''
})

describe('Nav mobile menu — modal overlay behavior', () => {
  it('opening moves focus into the menu and marks the toggle expanded', () => {
    setViewport(true)
    renderNav()
    fireEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    const menu = document.getElementById('nav-menu')
    expect(menu.className).toMatch(/is-open/)
    // focus started inside the overlay, not on the obscured page
    expect(menu.contains(document.activeElement)).toBe(true)
  })

  it('Escape closes the menu and restores focus to the toggle', () => {
    setViewport(true)
    renderNav()
    fireEvent.click(toggle())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(toggle())
  })

  it('makes the page behind inert while open and clears it on close', () => {
    setViewport(true)
    renderNav()
    const main = document.getElementById('main')
    const foot = document.querySelector('footer')
    fireEvent.click(toggle())
    expect(main.inert).toBe(true)
    expect(foot.inert).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(main.inert).toBe(false)
    expect(foot.inert).toBe(false)
  })

  it('locks body scroll while open and restores it on close', () => {
    setViewport(true)
    renderNav()
    fireEvent.click(toggle())
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.body.style.overflow).toBe('')
  })

  it('contains Tab focus within the header (wraps last → first, first → last)', () => {
    setViewport(true)
    renderNav()
    fireEvent.click(toggle())
    const header = document.querySelector('header.nav')
    const focusable = [...header.querySelectorAll('a[href], button:not([disabled])')]
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('does NOT apply modal behavior above the overlay breakpoint (desktop inline nav)', () => {
    setViewport(false) // desktop: matchMedia(max-width:1240px) is false
    renderNav()
    // The toggle is display:none on desktop, but the state can still be toggled
    // in jsdom; the effect must early-return so the background stays interactive.
    fireEvent.click(toggle())
    expect(document.getElementById('main').inert).toBeFalsy()
    expect(document.body.style.overflow).toBe('')
  })

  it('renders the section links and the Apply CTA', () => {
    setViewport(true)
    renderNav()
    const menu = within(document.getElementById('nav-menu'))
    expect(menu.getByRole('link', { name: /network/i })).toBeInTheDocument()
    expect(menu.getByRole('link', { name: /story/i })).toBeInTheDocument()
    expect(menu.getByRole('link', { name: /apply/i })).toHaveAttribute('href', '/apply')
  })
})

describe('Nav scrollspy + menu behavior', () => {
  it('marks the nav link active for the section reported in view (landing only)', () => {
    setViewport(true)
    // Controllable IntersectionObserver: capture the callback, expose a fire().
    let cb
    const original = globalThis.IntersectionObserver
    globalThis.IntersectionObserver = class {
      constructor(fn) {
        cb = fn
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    try {
      // The scrollspy observes elements by id — provide one.
      render(
        <MemoryRouter initialEntries={['/']}>
          <Nav />
          <section id="proof">proof</section>
        </MemoryRouter>,
      )
      act(() => {
        cb([{ isIntersecting: true, target: { id: 'proof' } }])
      })
      const proofLink = screen.getByRole('link', { name: /proof/i })
      expect(proofLink.className).toMatch(/is-active/)
    } finally {
      globalThis.IntersectionObserver = original
    }
  })

  it('closes the open menu when a section link is clicked', () => {
    setViewport(true)
    render(
      <MemoryRouter initialEntries={['/']}>
        <Nav />
      </MemoryRouter>,
    )
    fireEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('link', { name: /story/i }))
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
  })

  it('renders the reading-progress hairline as decorative (aria-hidden)', () => {
    setViewport(true)
    const { container } = renderNav()
    const bar = container.querySelector('.nav-progress')
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('Nav dark-treatment seed (prerender FOUC guard)', () => {
  const renderAt = (path) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Nav />
      </MemoryRouter>,
    )

  it('a non-landing route seeds the LIGHT treatment (no on-dark) on first render', () => {
    setViewport(false)
    const { container } = renderAt('/story')
    expect(container.querySelector('header.nav').className).not.toMatch(/on-dark/)
  })

  it('the landing route seeds the DARK treatment (on-dark) over the hero', () => {
    setViewport(false)
    const { container } = renderAt('/')
    expect(container.querySelector('header.nav').className).toMatch(/on-dark/)
  })
})
