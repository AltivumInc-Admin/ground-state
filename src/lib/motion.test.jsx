import { afterEach, describe, expect, it } from 'vitest'
import { act, render } from '@testing-library/react'
import { setMotionPaused, useReducedMotion } from './motion.js'

afterEach(() => setMotionPaused(false))

describe('motion pause store', () => {
  it('mirrors pause state onto <html> for CSS consumers (fig. 03 breathe)', () => {
    setMotionPaused(true)
    expect(document.documentElement.hasAttribute('data-motion-paused')).toBe(true)
    setMotionPaused(false)
    expect(document.documentElement.hasAttribute('data-motion-paused')).toBe(false)
  })
})

describe('useReducedMotion — live OS reduced-motion', () => {
  it('flips when the media query change fires (mid-session), not just at mount', () => {
    // Controllable matchMedia: a live `matches` flag + a stored change listener.
    const state = { matches: false, listener: null }
    const original = window.matchMedia
    window.matchMedia = (query) => ({
      get matches() {
        return query.includes('prefers-reduced-motion') ? state.matches : false
      },
      media: query,
      addEventListener: (_e, fn) => {
        state.listener = fn
      },
      removeEventListener: () => {
        state.listener = null
      },
    })

    let value
    const Probe = () => {
      value = useReducedMotion()
      return null
    }
    try {
      render(<Probe />)
      expect(value).toBe(false)
      // OS 'Reduce motion' flipped ON while the page is open — the stored
      // change listener is useSyncExternalStore's notifier; firing it must
      // re-render the subscriber with the new snapshot.
      act(() => {
        state.matches = true
        state.listener?.()
      })
      expect(value).toBe(true)
    } finally {
      window.matchMedia = original
    }
  })
})
