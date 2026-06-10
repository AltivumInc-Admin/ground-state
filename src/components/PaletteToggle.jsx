import { useEffect, useState } from 'react'

/*
 * Palette comparison toggle. Both palettes follow the same 60/20/10/10
 * roles (base / accent / secondary / dark); switching swaps the design
 * tokens via data-theme on <html>. Persisted in localStorage and applied
 * pre-paint by the inline script in index.html.
 */
const THEMES = [
  {
    id: 'ember',
    name: 'Palette 01 — Parchment, Chestnut, Mushroom, Obsidian',
    dots: ['#E7E1D4', '#B0664E', '#A4988C', '#05040B'],
  },
  {
    id: 'olive',
    name: 'Palette 02 — Sage, Silver, Olive, Darkmoss',
    dots: ['#E3E4DC', '#C4C4C6', '#827D65', '#494637'],
  },
]

function readTheme() {
  try {
    const saved = localStorage.getItem('tqc-theme')
    return THEMES.some((t) => t.id === saved) ? saved : 'ember'
  } catch {
    return 'ember'
  }
}

export default function PaletteToggle() {
  const [theme, setTheme] = useState(readTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'ember') {
      delete root.dataset.theme
    } else {
      root.dataset.theme = theme
    }
    try {
      localStorage.setItem('tqc-theme', theme)
    } catch {
      /* private mode — toggle still works for the session */
    }
  }, [theme])

  return (
    <div className="palette-toggle" role="group" aria-label="Color palette comparison">
      {THEMES.map((t, i) => (
        <button
          key={t.id}
          type="button"
          className={`palette-option${theme === t.id ? ' is-active' : ''}`}
          aria-pressed={theme === t.id}
          title={t.name}
          onClick={() => setTheme(t.id)}
        >
          <span className="palette-dots" aria-hidden="true">
            {t.dots.map((hex) => (
              <span key={hex} className="palette-dot" style={{ backgroundColor: hex }} />
            ))}
          </span>
          <span className="palette-num" aria-hidden="true">
            0{i + 1}
          </span>
          <span className="visually-hidden">{t.name}</span>
        </button>
      ))}
    </div>
  )
}
