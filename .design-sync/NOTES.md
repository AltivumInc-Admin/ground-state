# design-sync notes — Ground State Society

Repo shape: a Vite SPA **landing page**, not a component library. Synced as the
`package` shape in **synth-entry mode** (no library build; components are `.jsx`
default exports).

## Setup that makes the build work (don't lose these)
- **Synth entry** `.design-sync/synth-entry.jsx` (wired via `cfg.entry`): re-exports
  each component as a NAMED export — the components are `export default`, which the
  converter's auto-synth (`export *`) cannot reach. It also `import`s the three design
  CSS files so esbuild extracts them into `_ds_bundle.css`. That is how the design
  language reaches the styles.css closure — NOT via `tokens/`: the tokens live in local
  `src/styles/*.css`, not a package, so `tokensPkg`/`tokensGlob` do not apply here.
- **`--entry` is required**: the repo isn't installed in its own `node_modules`, so the
  build needs the synth entry to walk up to the repo's `package.json` (else ENOENT on
  `node_modules/<pkg>/package.json`).
- **Router provider**: Footer/Nav use react-router `<Link>` → blank without a Router.
  `cfg.extraEntries:["react-router-dom"]` + `cfg.provider.component:"MemoryRouter"`.
- **Fonts** ship via `cfg.extraFonts` → the installed @fontsource CSS (Archivo Variable
  + IBM Plex Mono 400/500/700).

## Excluded (deliberate)
- `BlochScene`, `GroundStateScene` (`src/three/*`) — the ONLY `@react-three/fiber` roots.
  R3F's react-reconciler imports `scheduler`, which the converter's vendor-React bundle
  rejects (`[SCHEDULER_MISSING]`), breaking the WHOLE shared bundle. Pure WebGL canvases,
  uncomposable in a DS. Set to `null` in `componentSrcMap`. No other component imports them.
- `src/pages/*` — routes, not components (never added to the map).

## Known render warns (triaged legitimate — NOT new on re-sync)
- `Mark` — `[RENDER_THIN]`: small wordmark mark, legitimately short.
- `WaveParticle` — `[RENDER_THIN]`: wide/short wave-particle figure, legitimate.

## Known false positive — "Missing brand fonts" banner (cosmetic, ignore)
The DS-pane self-check shows "Missing brand fonts: + 0.2vw (--text-base), + 0.5vw
(--text-lede), + 3.1vw (--text-h2), + 3.4vw (--text-stat)". These are NOT fonts —
they're the `vw` terms of the fluid `clamp()` type-scale tokens (e.g.
`--text-h2: clamp(2rem, 1.2rem + 3.1vw, 3.7rem)`). The app's font scraper keys on
the `--text-*` token names and mis-parses the clamp value as a font-family fallback.
The REAL brand families (`Archivo Variable`, `IBM Plex Mono`) ship with `@font-face`
(fonts/fonts.css, 34 woff/woff2) and render correctly in every card. No real text
falls back. Do NOT "Upload fonts" and do NOT rename the `--text-*` tokens (that would
desync the design language from the real repo). Converter's own validate does NOT flag
this — only the app self-check does.

## Floor cards (render empty with default props)
- `Cursor` (invisible custom pointer), `Nav` (GSAP entrance hides it initially),
  `HeroScene`, `Mosaic` (needs item props). Authorable on any later re-sync.

## Re-sync risks
- `cfg.extraFonts` point into `node_modules/@fontsource*` — a fresh clone must
  `npm install` the repo deps first or fonts go missing.
- The synth entry + `componentSrcMap` are hand-maintained: a NEW component in `src/`
  must be added to BOTH `.design-sync/synth-entry.jsx` and `componentSrcMap`, or it
  won't sync.
- Sections (`Problem`/`Proof`/`Story`/`Hero`/`Inside`/`FinalCta`) render their full
  static DOM in a card — they are GSAP-scroll-driven in the real app, so the card shows
  the pre-animation state. Expected, not a defect.
