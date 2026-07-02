import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { setMotionPaused } from '../../lib/motion.js'

/* Stub only the leaf R3F scene — the wrapper's own logic (the boundary,
   the reduced/paused derivation, the idle ramp) is what's under test. */
const scene = vi.hoisted(() => ({ shouldThrow: false }))
vi.mock('../../three/GroundStateScene.jsx', () => ({
  default: ({ reduced, active }) => {
    if (scene.shouldThrow) throw new Error('webgl unavailable')
    return (
      <div
        data-testid="scene-stub"
        data-reduced={String(reduced)}
        data-active={String(active)}
      />
    )
  },
}))

const { default: HeroScene } = await import('./HeroScene.jsx')

afterEach(() => {
  scene.shouldThrow = false
  setMotionPaused(false)
})

describe('HeroScene wrapper', () => {
  it('runs unreduced by default and ramps active after the idle gate', async () => {
    render(<HeroScene />)
    const stub = await screen.findByTestId('scene-stub')
    expect(stub).toHaveAttribute('data-reduced', 'false')
    // active starts false (the entrance gets the main thread first), then
    // the idle/timeout gate flips it
    await waitFor(() =>
      expect(screen.getByTestId('scene-stub')).toHaveAttribute('data-active', 'true'),
    )
  })

  it('derives reduced from prefers-reduced-motion', async () => {
    const original = window.matchMedia
    window.matchMedia = (query) => ({
      ...original(query),
      matches: query.includes('prefers-reduced-motion'),
    })
    try {
      render(<HeroScene />)
      expect(await screen.findByTestId('scene-stub')).toHaveAttribute(
        'data-reduced',
        'true',
      )
    } finally {
      window.matchMedia = original
    }
  })

  it('derives reduced from the pause store', async () => {
    setMotionPaused(true)
    render(<HeroScene />)
    expect(await screen.findByTestId('scene-stub')).toHaveAttribute(
      'data-reduced',
      'true',
    )
  })

  it('contains a scene failure: boundary renders null and reports onFailed', async () => {
    scene.shouldThrow = true
    const onFailed = vi.fn()
    // React logs the caught error — keep the test output clean
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { container } = render(<HeroScene onFailed={onFailed} />)
      await waitFor(() => expect(onFailed).toHaveBeenCalled())
      expect(screen.queryByTestId('scene-stub')).toBeNull()
      // The styled holder survives — quiet failure, never a broken page
      expect(container.querySelector('.hero-scene')).toBeInTheDocument()
    } finally {
      errSpy.mockRestore()
    }
  })
})
