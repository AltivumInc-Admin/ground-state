import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { setMotionPaused } from '../../lib/motion.js'
import BlochFigure from './BlochFigure.jsx'

/* No mocks: in jsdom hasWebGL() returns false (no WebGL context), so the
   wrapper takes its real fallback path — the accurate BlochSphere SVG.
   This is the branch every no-WebGL / reduced-motion visitor gets. */

afterEach(() => setMotionPaused(false))

describe('BlochFigure fallback path', () => {
  it('renders the accessible SVG figure when WebGL is unavailable', () => {
    render(<BlochFigure />)
    expect(
      screen.getByRole('img', { name: /a bloch sphere/i }),
    ).toBeInTheDocument()
  })

  it('still renders the SVG figure while motion is paused', () => {
    setMotionPaused(true)
    render(<BlochFigure />)
    expect(
      screen.getByRole('img', { name: /a bloch sphere/i }),
    ).toBeInTheDocument()
  })
})
