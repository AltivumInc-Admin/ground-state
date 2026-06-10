import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Mark from './Mark.jsx'

const SECTIONS = [
  { num: '03', id: 'network', label: 'The Network' },
  { num: '04', id: 'problem', label: 'The Problem' },
  { num: '05', id: 'story', label: 'The Story' },
  { num: '06', id: 'proof', label: 'The Proof' },
  { num: '07', id: 'inside', label: 'Inside' },
  { num: '08', id: 'join', label: 'Join' },
]

export default function Nav() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('')
  const { pathname } = useLocation()
  const onLanding = pathname === '/'

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
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="nav-brand" aria-label="The Quantum Collective — home">
          <Mark />
          <span>The Quantum Collective</span>
        </Link>

        <nav aria-label="Page sections">
          <button
            type="button"
            className="nav-toggle"
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
                  className={`nav-link${active === id && onLanding ? ' is-active' : ''}`}
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
