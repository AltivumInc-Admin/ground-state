import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const q = { xTo: null, yTo: null }
vi.mock('./gsap-core.js', () => {
  const gsap = {
    quickTo: (_el, prop) => {
      const fn = vi.fn()
      if (prop === 'x') q.xTo = fn
      if (prop === 'y') q.yTo = fn
      return fn
    },
  }
  return { gsap }
})

const { initMagnetic } = await import('./magnetic.js')

const setMedia = ({ fine = true, reduced = false } = {}) => {
  window.matchMedia = (query) => ({
    matches: query.includes('pointer: fine') ? fine : query.includes('prefers-reduced-motion') ? reduced : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  })
}

beforeEach(() => {
  q.xTo = null
  q.yTo = null
  document.body.innerHTML = ''
})
afterEach(() => vi.restoreAllMocks())

describe('initMagnetic gating', () => {
  it('does not attach the delegated listener on a coarse pointer', () => {
    setMedia({ fine: false })
    const spy = vi.spyOn(document, 'addEventListener')
    initMagnetic()
    expect(spy.mock.calls.some((c) => c[0] === 'pointerover')).toBe(false)
  })

  it('does not attach under prefers-reduced-motion', () => {
    setMedia({ fine: true, reduced: true })
    const spy = vi.spyOn(document, 'addEventListener')
    initMagnetic()
    expect(spy.mock.calls.some((c) => c[0] === 'pointerover')).toBe(false)
  })
})

describe('initMagnetic behavior (fine pointer, no reduced motion)', () => {
  it('wires quickTo on a .btn hover and springs it back + cleans up on leave', () => {
    setMedia({ fine: true, reduced: false })
    initMagnetic()

    const btn = document.createElement('button')
    btn.className = 'btn'
    document.body.appendChild(btn)

    btn.dispatchEvent(new Event('pointerover', { bubbles: true }))
    expect(btn.dataset.magnet).toBe('1')
    expect(q.xTo).toBeTypeOf('function')

    // a move pulls the button toward the cursor (non-zero translate)
    btn.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 999, clientY: 999 }))
    expect(q.xTo).toHaveBeenCalled()

    // leave springs back to 0 and de-registers
    btn.dispatchEvent(new Event('pointerleave'))
    expect(q.xTo).toHaveBeenLastCalledWith(0)
    expect(q.yTo).toHaveBeenLastCalledWith(0)
    expect(btn.dataset.magnet).toBeUndefined()
  })
})
