import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'

/* The Fx motion path is invisible to a normal jsdom run: GSAP+ScrollTrigger need
   real layout/scroll. So we mock gsap-core and assert the DECLARATIVE WIRING —
   which gsap calls fire with what args — which is exactly what regressions break
   (an autoAlpha regression, a lost reduced-motion gate, a broken count parse).
   The real useGSAP is kept (it runs our callback via real gsap.context in a
   layout effect), so ref.current is populated when the wiring runs. */

const record = { from: [], to: [], fromTo: [], registerPlugin: [], cleanups: [] }

vi.mock('./gsap-core.js', async () => {
  const { useGSAP } = await vi.importActual('@gsap/react')
  const mm = {
    add: (_query, cb) => {
      // run every matchMedia branch (motion-OK + tilt) and keep its cleanup so
      // a test can invoke the revert path
      const cl = cb()
      if (typeof cl === 'function') record.cleanups.push(cl)
      return cl
    },
  }
  const gsap = {
    matchMedia: () => mm,
    from: (...a) => record.from.push(a),
    to: (...a) => record.to.push(a),
    fromTo: (...a) => record.fromTo.push(a),
    set: () => {},
    quickTo: () => () => {},
    timeline: () => ({ from: () => {} }),
    context: (fn) => {
      fn()
      return { revert: () => {} }
    },
    registerPlugin: (...a) => record.registerPlugin.push(a),
  }
  return { gsap, useGSAP, MOTION_OK: '(prefers-reduced-motion: no-preference)', ScrollTrigger: {} }
})

const { default: Fx } = await import('./fx.jsx')

afterEach(() => {
  record.from.length = 0
  record.to.length = 0
  record.fromTo.length = 0
  record.registerPlugin.length = 0
  record.cleanups.length = 0
  cleanup()
})

// find the gsap.from call whose target is (or contains) the given element
const fromCallFor = (el) => record.from.find(([t]) => t === el)

describe('Fx wiring', () => {
  it('renders as the given tag with className + children', () => {
    const { container, getByText } = render(
      <Fx as="section" className="x">
        <p>hi</p>
      </Fx>,
    )
    const wrap = container.querySelector('section.x')
    expect(wrap).toBeInTheDocument()
    expect(getByText('hi')).toBeInTheDocument()
  })

  it('wires data-fade with opacity:0 — NOT autoAlpha (keeps reveal content in the a11y tree)', () => {
    const { container } = render(
      <Fx>
        <div data-fade>
          <a href="/apply">Apply</a>
        </div>
      </Fx>,
    )
    const fadeEl = container.querySelector('[data-fade]')
    const call = fromCallFor(fadeEl)
    expect(call, 'gsap.from was called for the data-fade element').toBeTruthy()
    const cfg = call[1]
    expect(cfg.opacity).toBe(0)
    expect(cfg).not.toHaveProperty('autoAlpha')
    expect(cfg.scrollTrigger.once).toBe(true)
  })

  it('wires data-stagger onto the children with opacity:0', () => {
    const { container } = render(
      <Fx>
        <ul data-stagger>
          <li>a</li>
          <li>b</li>
        </ul>
      </Fx>,
    )
    const kids = container.querySelector('[data-stagger]').children
    const call = record.from.find(([t]) => t === kids)
    expect(call).toBeTruthy()
    expect(call[1].opacity).toBe(0)
    expect(call[1]).not.toHaveProperty('autoAlpha')
  })

  it('parses data-count attributes and formats the counter text via onUpdate', () => {
    const { container } = render(
      <Fx>
        <span data-count="1200" data-prefix="$" data-suffix="+" data-decimals="0">
          $1,200+
        </span>
      </Fx>,
    )
    const el = container.querySelector('[data-count]')
    const call = record.to.find(([target]) => target && typeof target === 'object' && 'n' in target)
    expect(call, 'gsap.to was called for the count state').toBeTruthy()
    const [state, cfg] = call
    expect(cfg.n).toBe(1200)
    // drive the tween's onUpdate at the end value → the formatted write
    state.n = 1200
    cfg.onUpdate()
    expect(el.textContent).toBe('$1200+')
  })

  it('does NOT fetch the choreography plugins when no data-split/data-draw is present (the chunk gate)', () => {
    render(
      <Fx>
        <div data-fade>plain</div>
      </Fx>,
    )
    // registerPlugin only runs inside the post-import .then; the gate returns first
    expect(record.registerPlugin.length).toBe(0)
  })

  it('restores the authored data-count text on matchMedia revert (no stranded partial number)', () => {
    const { container } = render(
      <Fx>
        {/* single line so textContent has no JSX-indentation whitespace */}
        <span data-count="1200" data-prefix="$" data-suffix="+">$1,200+</span>
      </Fx>,
    )
    const el = container.querySelector('[data-count]')
    // simulate a mid-count write, then revert (reduced-motion flip / unmount)
    const [state, cfg] = record.to.find(([t]) => t && typeof t === 'object' && 'n' in t)
    state.n = 640
    cfg.onUpdate()
    expect(el.textContent).toBe('$640+')
    record.cleanups.forEach((restore) => restore())
    expect(el.textContent).toBe('$1,200+') // back to the authored fallback
  })
})

describe('Fx plugin-chunk load failure', () => {
  it('a rejected plugin import is caught, not an unhandled rejection', async () => {
    // Make the dynamic chunk fail (stale-deploy 404 / flaky network).
    vi.doMock('gsap/SplitText', () => {
      throw new Error('chunk 404')
    })
    vi.doMock('gsap/DrawSVGPlugin', () => {
      throw new Error('chunk 404')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      render(
        <Fx>
          <h2 data-split>Title</h2>
        </Fx>,
      )
      // let the Promise.all reject and the .catch run
      await new Promise((r) => setTimeout(r, 0))
      expect(warn.mock.calls.some((c) => String(c[0]).includes('fx_plugin_load_failed'))).toBe(true)
    } finally {
      warn.mockRestore()
      vi.doUnmock('gsap/SplitText')
      vi.doUnmock('gsap/DrawSVGPlugin')
    }
  })
})
