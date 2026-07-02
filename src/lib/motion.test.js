import { afterEach, describe, expect, it } from 'vitest'
import { setMotionPaused } from './motion.js'

afterEach(() => setMotionPaused(false))

describe('motion pause store', () => {
  it('mirrors pause state onto <html> for CSS consumers (fig. 03 breathe)', () => {
    setMotionPaused(true)
    expect(document.documentElement.hasAttribute('data-motion-paused')).toBe(true)
    setMotionPaused(false)
    expect(document.documentElement.hasAttribute('data-motion-paused')).toBe(false)
  })
})
