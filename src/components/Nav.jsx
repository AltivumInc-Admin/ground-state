import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Mark from './Mark.jsx'

const SECTIONS = [
  { num: '01', id: 'network', label: 'Network' },
  { num: '02', id: 'problem', label: 'Problem' },
  { num: '03', id: 'story', label: 'Story' },
  { num: '04', id: 'proof', label: 'Proof' },
  { num: '05', id: 'inside', label: 'Inside' },
  { num: '06', id: 'join', label: 'Join' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('')
  const [overDark, setOverDark] = useState(true)
  const { pathname } = useLocation()
  const onLanding = pathname === '/'

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

  return (
    <header className={`nav${overDark || open ? ' on-dark ground-dark' : ''}`}>
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
          Funded quantum founders
        </p>

        <nav aria-label="Page sections">
          <button
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
