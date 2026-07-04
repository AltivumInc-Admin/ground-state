import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Mark from './Mark.jsx'
import { gsap, useGSAP, MOTION_OK } from '../lib/gsap-core.js'

const SECTIONS = [
  { num: '01', id: 'network', label: 'Network' },
  { num: '02', id: 'problem', label: 'Problem' },
  { num: '03', id: 'proof', label: 'Proof' },
  { num: '04', id: 'inside', label: 'Inside' },
  { num: '05', id: 'join', label: 'Join' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('')
  const [overDark, setOverDark] = useState(true)
  const progressRef = useRef(null)
  const { pathname } = useLocation()
  const onLanding = pathname === '/'

  // Reading-progress hairline along the nav's bottom edge
  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add(MOTION_OK, () => {
      gsap.fromTo(
        progressRef.current,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { start: 0, end: 'max', scrub: 0.4, invalidateOnRefresh: true },
        },
      )
      return undefined
    })
  }, [])

  // The nav floats over the black hero (ghost ink), then switches to
  // the light treatment once the hero scrolls away.
  useEffect(() => {
    if (!onLanding) {
      setOverDark(false)
      return
    }
    let raf = 0
    const measure = () => {
      raf = 0
      const hero = document.getElementById('network')
      if (!hero) return
      setOverDark(hero.getBoundingClientRect().bottom > 72)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [onLanding])

  // Scrollspy — highlight the section currently in view
  useEffect(() => {
    if (!onLanding || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id)
        })
      },
      { rootMargin: '-40% 0px -55% 0px' },
    )
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [onLanding])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const headerRef = useRef(null)
  const toggleRef = useRef(null)

  // The open mobile menu is a fullscreen overlay (position:fixed inset:0), so
  // it must behave as a modal, not a bare disclosure: Escape closes it, Tab is
  // contained to the visible header, the obscured page goes inert (removed from
  // both the tab order and the a11y tree), and the body scroll locks. Gated to
  // the overlay breakpoint — above 1240px the same <ul> is the inline nav and
  // none of this applies.
  useEffect(() => {
    if (!open) return undefined
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 1240px)').matches) {
      return undefined
    }
    const header = headerRef.current
    if (!header) return undefined
    // Capture at setup for the cleanup's focus-restore (exhaustive-deps): the
    // toggle is the same node throughout the open state.
    const toggleEl = toggleRef.current

    // Every header control is visible in this gated state (open + overlay
    // breakpoint), so the selector is the full set — no layout-based visibility
    // filter (which also would not work under jsdom's no-layout DOM).
    const getFocusable = () => [...header.querySelectorAll('a[href], button:not([disabled])')]

    const bgNodes = [document.getElementById('main'), document.querySelector('footer')].filter(
      Boolean,
    )
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    bgNodes.forEach((n) => {
      n.inert = true
    })
    // Start on the first menu item — the content that just opened — rather
    // than stranded on the now-obscured page. (The trap below still spans the
    // whole header, so Shift+Tab reaches the Close toggle and brand.)
    document.getElementById('nav-menu')?.querySelector('a[href], button')?.focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        return
      }
      if (e.key !== 'Tab') return
      const items = getFocusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      bgNodes.forEach((n) => {
        n.inert = false
      })
      // Return focus to the control that opened the menu — but only if the trap
      // still owns focus, so a route-change unmount doesn't steal it.
      const owned = !document.activeElement || header.contains(document.activeElement) || document.activeElement === document.body
      if (owned) toggleEl?.focus()
    }
  }, [open])

  // Opening at mobile then resizing to desktop would leave open=true: the
  // overlay CSS drops to the inline nav while the inert/scroll-lock persisted.
  // Close on cross-up so the modal state can never outlive the overlay.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mq = window.matchMedia('(min-width: 1241px)')
    const onChange = (e) => {
      if (e.matches) setOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <header ref={headerRef} className={`nav${overDark || open ? ' on-dark ground-dark' : ''}`}>
      <span ref={progressRef} className="nav-progress" aria-hidden="true" />
      <div className="container nav-inner">
        <Link to="/" className="nav-brand" aria-label="The Ground State Society — home">
          <Mark />
          <span className="nav-wordmark label">
            Ground State
            <br />
            Society
          </span>
        </Link>

        <p className="nav-tag label" aria-hidden="true">
          Members only
          <br />
          Vetted quantum founders
        </p>

        <nav aria-label="Page sections">
          <button
            ref={toggleRef}
            type="button"
            className="nav-toggle label"
            aria-expanded={open}
            aria-controls="nav-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Close' : 'Menu'}
          </button>
          <ul id="nav-menu" className={`nav-links${open ? ' is-open' : ''}`}>
            {SECTIONS.map(({ num, id, label }) => (
              <li key={id}>
                <Link
                  to={`/#${id}`}
                  className={`nav-link label${active === id && onLanding ? ' is-active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  <em>{num}</em>
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/story"
                className={`nav-link label${pathname === '/story' ? ' is-active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <em>06</em>
                Story
              </Link>
            </li>
            <li>
              <Link to="/apply" className="btn btn-primary nav-cta" onClick={() => setOpen(false)}>
                Apply
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}
