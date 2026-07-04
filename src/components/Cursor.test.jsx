import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('../lib/gsap-core.js', () => {
  const gsap = {
    quickTo: () => vi.fn(),
    set: vi.fn(),
    to: vi.fn(),
  }
  return { gsap }
})

const { default: Cursor } = await import('./Cursor.jsx')

// Controllable matchMedia: fine-pointer and reduced-motion are the two gates.
const setMedia = ({ fine = true, reduced = false } = {}) => {
  window.matchMedia = (q) => ({
    matches: q.includes('pointer: fine') ? fine : q.includes('prefers-reduced-motion') ? reduced : false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  })
}

const reticle = () => document.querySelector('.cursor-reticle')

afterEach(cleanup)

describe('Cursor reticle gating', () => {
  it('does nothing on a coarse pointer (never activates)', () => {
    setMedia({ fine: false })
    const spy = vi.spyOn(window, 'addEventListener')
    render(<Cursor />)
    expect(reticle().style.display).not.toBe('block')
    expect(spy.mock.calls.some((c) => c[0] === 'pointermove')).toBe(false)
    spy.mockRestore()
  })

  it('does nothing under prefers-reduced-motion', () => {
    setMedia({ fine: true, reduced: true })
    render(<Cursor />)
    expect(reticle().style.display).not.toBe('block')
  })

  it('activates on a fine pointer with no reduced-motion', () => {
    setMedia({ fine: true, reduced: false })
    const spy = vi.spyOn(window, 'addEventListener')
    render(<Cursor />)
    expect(reticle().style.display).toBe('block')
    expect(spy.mock.calls.some((c) => c[0] === 'pointermove')).toBe(true)
    spy.mockRestore()
  })
})

describe('Cursor reticle — detached target guard', () => {
  it('stops framing a target once it leaves the DOM (no rect read on a dead node)', () => {
    setMedia({ fine: true, reduced: false })
    // A HOT target the reticle will acquire.
    const btn = document.createElement('button')
    document.body.appendChild(btn)
    const rectSpy = vi.spyOn(btn, 'getBoundingClientRect')
    render(<Cursor />)

    // Acquire it: pointerover bubbles to the document-level capture listener.
    btn.dispatchEvent(new Event('pointerover', { bubbles: true }))
    const framedOnce = rectSpy.mock.calls.length
    expect(framedOnce).toBeGreaterThan(0)

    // Route change unmounts the framed node; a scroll would re-frame it.
    btn.remove()
    window.dispatchEvent(new Event('scroll'))
    // The isConnected guard drops the dead target — no further rect reads.
    expect(rectSpy.mock.calls.length).toBe(framedOnce)
    rectSpy.mockRestore()
  })
})
