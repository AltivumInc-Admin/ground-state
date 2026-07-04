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

  it('renders the control and toggles the pause store + aria-pressed', () => {
    render(<MotionToggle />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(btn)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    // the visible label follows the state
    expect(screen.getByRole('button').textContent).toMatch(/resume/i)
  })
})
