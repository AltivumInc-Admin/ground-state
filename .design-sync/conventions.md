# Ground State Society — building with this design system

This system is a **global CSS design language** (tokens on `:root` + component
classes), not a prop-styled system. You style your own layout with the design
tokens and compose using the global classes; components expose almost no style
props. Read `_ds_bundle.css` (reached from `styles.css`) for the full vocabulary,
and each component's `<Name>.prompt.md` / `<Name>.d.ts` for its API.

## Setup / wrapping
- **No theme provider.** The tokens live on `:root` in the bundled stylesheet —
  importing `styles.css` is all the theming you need.
- **Router.** `Footer` and `Nav` use react-router `<Link>`. Wrap any tree that
  includes them in a `<MemoryRouter>` (or `<BrowserRouter>`), or they throw.
- **Dark panels.** Wrap a region in `className="ground-dark"` to switch to the
  dark token context (it remaps `--ink`, `--bg`, borders, etc.). `Footer`, `Proof`,
  and parts of `FinalCta` live on it. Light is the default; don't hand-set dark colors.

## The styling idiom (real vocabulary)
- **Type:** `font-family: var(--font-display)` (Archivo — headings/wordmark),
  `var(--font-body)` (body), `var(--font-mono)` (IBM Plex Mono — labels/eyebrows).
  Sizes: `var(--text-h2 | --text-h3 | --text-lede | --text-stat | --text-base |
  --text-sm | --text-xs | --text-wordmark)`.
- **Color:** text `var(--ink | --ink-mute | --ink-soft)`; brand accent
  `var(--accent | --accent-display)`; surfaces `var(--bg | --bg-raised | --bg-deep)`;
  borders `var(--line | --line-strong)`.
- **Space/shape:** section rhythm `var(--space-section)`, gutters
  `var(--container-pad)`, corners `var(--radius)`, nav height `var(--nav-h)`.
- **Composition classes:** page width `container`; eyebrow labels `kicker` and
  `label` (mono, uppercase); buttons `btn` + `btn-primary` | `btn-ghost`, with
  `btn-arrow` for the arrow affordance. Section patterns also ship as classes
  (`signal`, `plan-card`, `tier`, `problem-card`, `proof-quote`, `energy-levels`,
  `apply-*`, `footer-*`, `nav-*`) — prefer these over reinventing them.

## Idiomatic snippet
```jsx
import { Mark } from 'ground-state-society-landing'

function GroundStatePanel() {
  return (
    <section className="ground-dark" style={{ padding: 'var(--space-section) var(--container-pad)' }}>
      <div className="container">
        <p className="kicker">The free tier</p>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h2)', color: 'var(--ink)' }}>
          Read the Signal.
        </h2>
        <Mark size={48} />
        <button className="btn btn-primary btn-arrow">Subscribe free</button>
      </div>
    </section>
  )
}
```

Note: the R3F scenes (`BlochScene`, `GroundStateScene`) are intentionally not in
this system — they are WebGL canvases. The Bloch/energy **figures** (`BlochSphere`,
`BlochFigure`, `EnergyLevels`, `WaveParticle`) are plain DOM/SVG and compose freely.
