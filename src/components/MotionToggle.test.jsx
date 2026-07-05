import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { setMotionPaused } from '../lib/motion.js'
import MotionToggle from './MotionToggle.jsx'

const setReduced = (reduced) => {
  const original = window.matchMedia
  window.matchMedia = (q) => ({
    ...original(q),
    matches: q.includes('prefers-reduced-motion: reduce') ? reduced : false,
  })
  return () => {
    window.matchMedia = original
  }
}

afterEach(() => {
  setMotionPaused(false)
  cleanup()
})

describe('MotionToggle', () => {
  it('renders nothing under prefers-reduced-motion (the scenes are already static)', () => {
    const restore = setReduced(true)
    try {
      const { container } = render(<MotionToggle />)
      expect(container.querySelector('button')).toBeNull()
    } finally {
      restore()
    }
  })

  it('toggles the pause store via a state-describing label (no contradictory aria-pressed)', () => {
    render(<MotionToggle />)
    const btn = screen.getByRole('button')
    expect(btn.textContent).toMatch(/pause/i)
    // The changing label carries state; pairing it with aria-pressed announced
    // contradictory state, so aria-pressed is deliberately absent.
    expect(btn).not.toHaveAttribute('aria-pressed')
    fireEvent.click(btn)
    expect(screen.getByRole('button').textContent).toMatch(/resume/i)
  })
})
