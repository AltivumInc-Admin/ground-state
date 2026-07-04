# Category F — the remaining 25 Medium/Lows (plan, 2026-07-04)

Source: Category F audit (features 14-20) in `docs/feature-optimization.md`, the
items still unchecked after the top-5 batch (#54). No Highs remain anywhere in
the 27-feature inventory — this is all polish, test debt, and single-source
cleanup. Three coherent batches; independent, any order, no deploys beyond the
ordinary merge → Amplify build.

The unifying technique for the test work: **mock `../lib/gsap-core.js`** so tests
assert the DECLARATIVE WIRING (which `gsap.from`/`quickTo`/`matchMedia` calls
happen, with what args) without needing real layout/scroll — the reason these
modules were "structurally untestable" is that GSAP+ScrollTrigger need a real
browser, but the wiring is exactly what regressions break (e.g. an autoAlpha
regression, a lost gate).

---

## Plan 1 — Cross-cutting test batch (+ the small resilience code fixes)

### Objective
Cover the site's busiest untested code — the Fx choreography engine, the two
pointer modules, MotionToggle, and broader Nav — and fix the three small
resilience gaps the coverage exposes (plugin-import rejection, data-count not
restored on motion revert, reticle stranding on a detached node). Turns 9
findings green.

### Prerequisites
- Vitest + jsdom + Testing Library + MemoryRouter (existing). The per-test
  `window.matchMedia` override pattern from `HeroScene.test.jsx`/`Nav.test.jsx`.
- Read: `src/lib/fx.jsx` (whole), `src/components/Cursor.jsx`, `src/lib/magnetic.js`,
  `src/components/MotionToggle.jsx`, `src/lib/usePageMeta.js:45-64` (canonical/og:url).

### Step-by-step
1. [14 M] `src/lib/fx.test.jsx` — `vi.mock('../lib/gsap-core.js')` returning a
   spy `gsap` (from/to/set/quickTo/matchMedia/timeline/context/registerPlugin)
   plus a `MOTION_OK` string and a `useGSAP` that runs its callback in an effect.
   Assert: (a) `<Fx>` renders its children and `as`/`className` wrapper; (b)
   data-fade wires `gsap.from(el, {opacity:0, y:28, …})` — NOT `autoAlpha`
   (locks the #54 a11y fix); (c) data-count parses `data-count`/`data-count-prefix`
   /`-suffix`/`-decimals` into the tween's target + writes the formatted initial
   text; (d) the plugin `import()` is gated — with no `[data-split]`/`[data-draw]`
   in scope the dynamic import is never attempted (spy on it via a
   `vi.mock('gsap/SplitText')`), and present → attempted.
2. [14 L] Plugin-import rejection handler (CODE): add `.catch()` to the
   `Promise.all([import('gsap/SplitText'), import('gsap/DrawSVGPlugin')])` at
   `fx.jsx:108` — a stale-deploy 404 / flaky fetch currently becomes an unhandled
   promise rejection. Log one structured `console.warn` and no-op (motion just
   doesn't play). Test: mock the import to reject → no throw, warn emitted.
3. [14 L] data-count revert (CODE): the count tween's `onUpdate` writes
   `el.textContent`; on `matchMedia` revert (reduced-motion flip / unmount) the
   element is left mid-count. Capture each data-count element's original
   textContent and restore it in the matchMedia cleanup. Test: after invoking
   the revert, textContent equals the authored value.
4. [15 M] `src/components/Cursor.test.jsx` + `src/lib/magnetic.test.js` —
   mock gsap-core; override matchMedia (pointer:fine true, reduced false).
   Cursor: asserts it returns early (no listeners) under coarse pointer AND under
   reduced-motion; under fine+no-reduce it attaches pointermove/pointerover/
   scroll and frames a HOT target (`gsap.quickTo` called with the element rect).
   magnetic: `initMagnetic()` returns early on coarse/reduced; on fine, a
   `pointerover` on a `.btn` wires quickTo + a pointerleave cleanup that springs
   back and removes listeners.
5. [15 L] Reticle detached-node guard (CODE): `Cursor.jsx` `frame(t)` calls
   `t.getBoundingClientRect()` on the acquired target; if the target unmounts
   (route change) the reticle pins to a stale/zeroed rect. Guard: at the top of
   `frame`, `if (!t.isConnected) { target = null; return }`. Test: frame a node,
   remove it, trigger onScroll → target cleared, no NaN/0,0 jump.
6. [16 M] `src/components/MotionToggle.test.jsx` — renders nothing before mount;
   after mount renders the button; click calls `setMotionPaused` and flips
   `aria-pressed`; hidden when `useReducedMotion()` is true (override matchMedia).
7. [16 L] localStorage persistence — extend `motion.test.jsx`: `setMotionPaused(true)`
   writes `gss-motion-paused=1`; assert via a `localStorage` spy/mock (jsdom's
   localStorage is flaky under the runner — inject a minimal mock if needed).
8. [17 M] Extend `src/components/Nav.test.jsx` — scrollspy: mock
   IntersectionObserver to fire an entry for a section id → that nav link gets
   `is-active` (on landing only); a menu link `onClick` closes the menu; the
   progress hairline element renders with `aria-hidden`.
9. [19 L] Extend `usePageMeta.test.jsx` — assert `link[rel=canonical]` href and
   `meta[property=og:url]` are rewritten to `SITE + pathname` per route (seeded
   in the head today but never asserted).
10. Gate: `npm run test:fe` green; the 3 code fixes (2,3,5) each verified by
    their new test failing pre-fix.

### File & code changes
| Action | File | Change |
|---|---|---|
| Create | `src/lib/fx.test.jsx` | wiring assertions (opacity-not-autoAlpha, data-count, plugin gate) |
| Create | `src/components/Cursor.test.jsx` | gating + framing wiring |
| Create | `src/lib/magnetic.test.js` | gating + magnet wiring |
| Create | `src/components/MotionToggle.test.jsx` | render/toggle/hidden-under-reduced |
| Modify | `src/lib/fx.jsx` | plugin-import `.catch`; data-count restore-on-revert |
| Modify | `src/components/Cursor.jsx` | `isConnected` guard in `frame()` |
| Modify | `src/lib/motion.test.jsx`, `src/components/Nav.test.jsx`, `src/lib/usePageMeta.test.jsx` | persistence, scrollspy, canonical/og:url |

### Testing & validation
`npm run test:fe` + `npm run lint` + `GSS_ALLOW_EMPTY_ISSUES=1 npm run build`.
The 3 code fixes are proven by writing the test first (red), then the fix (green).
Rollback: revert (test-heavy, minimal runtime surface).

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| gsap-core mock drifts from the real module surface | Med | Low | Mock only the members Fx/Cursor/magnetic actually call; a missing member throws loudly in the test |
| jsdom localStorage flakiness (setup already warns) | Med | Low | Inject a minimal in-memory localStorage mock in that one test |
| data-count restore changes a live counter's end value | Low | Med | Restore only on revert/unmount, never mid-animation; the tween's own onComplete still lands the final value on the normal path |

### Effort
Complexity: Medium. Time: 4-6 h. Files: 4 created, 5 modified.

---

## Plan 2 — Token / design-system single-source

### Objective
Every color flows through `tokens.css` — restore that invariant where five sites
bypass it: the powder accent hand-copied as a raw `rgb()` in 8 rules, translucent
palette `rgba()` literals, the `<select>` arrow data-URI that freezes `--accent`,
the mobile-menu CSS hardcoding dark-ground values, and the two pointer modules'
inline reduced-motion query. Turns ~6 findings green; no visual change.

### Prerequisites
- Read: `src/styles/tokens.css:53-57` (`--powder`/`--ghost` etc.), the 8 powder
  literals (`grep -n 'rgb(193, 216, 226)\|193,216,226' src/styles/components.css`),
  `components.css:152-158` (mobile-menu dark literals), `:761-762` (translucent
  rgba), `:1475` (select-arrow data-URI). `src/lib/motion.js` (`prefersReducedMotion`
  exists), `Cursor.jsx`, `magnetic.js`.
- `color-mix(in srgb, …)` is broadly supported (2026); the site already targets
  evergreen browsers.

### Step-by-step
1. [20 M] Powder single-source: replace each `rgba(193, 216, 226, α)` with
   `color-mix(in srgb, var(--powder) N%, transparent)` (α → N%), and any solid
   `rgb(193,216,226)` with `var(--powder)`. `grep` first to enumerate all 8;
   verify each rendered color is identical (color-mix with transparent reproduces
   the alpha). Comment the block: powder now single-sourced.
2. [20 L] Translucent palette rgba (`:761-762` + any siblings): same treatment —
   `color-mix(in srgb, var(--ghost|--umber|…) N%, transparent)` so the base color
   tracks the token.
3. [20 L] `<select>` arrow: a data-URI SVG can't read a CSS var, so `--accent` is
   frozen and won't re-resolve on `.ground-dark`. Convert to a `mask-image` (the
   arrow path) + `background-color: var(--accent)` on the pseudo/background layer,
   so the color comes from the token and flips with the ground. Verify the arrow
   renders identically on light and dark selects.
4. [17 L] Mobile-menu tokens: `components.css:146-158` hardcodes
   `rgba(247,247,255,…)` (ghost-on-dark) for the open menu. The menu is always
   dark ground — apply `.ground-dark` semantics: either add the class to the
   open `<ul>` in `Nav.jsx` (so `--ink`/`--line` re-resolve to the ghost values)
   or reference the `.ground-dark`-resolved tokens. Prefer the class route (one
   JSX change) so the values track the token layer. Verify the menu looks
   unchanged.
5. [14 L / 15 L] Reduced-motion gate consolidation: `Cursor.jsx` and
   `magnetic.js` inline `window.matchMedia('(prefers-reduced-motion: reduce)')`.
   Swap both to the shared `prefersReducedMotion()` from `motion.js` (keeps the
   current one-shot-at-init behavior; live-response is out of scope — noted).
   Leave the `(pointer: fine)` checks as-is (separate concern).

### File & code changes
| Action | File | Change |
|---|---|---|
| Modify | `src/styles/components.css` | powder → var/color-mix (8), translucent rgba → color-mix, select-arrow mask, mobile-menu tokens |
| Modify | `src/components/Nav.jsx` | `.ground-dark` on the open menu `<ul>` (option 4) |
| Modify | `src/components/Cursor.jsx`, `src/lib/magnetic.js` | inline query → `prefersReducedMotion()` |

### Testing & validation
`npm run test:fe` + `build`. Manual (real browser): the accent/powder surfaces,
the `<select>` arrow on both grounds, and the open mobile menu look pixel-identical
to before. A screenshot diff of Proof/FinalCta/Footer (powder), a `/apply` select,
and the mobile menu is the acceptance. Rollback: revert.

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| color-mix rounds a color slightly off the old rgba | Low | Low | color-mix with transparent is exact for alpha; eyeball each surface on both grounds |
| mask-image select arrow renders differently across browsers | Med | Low | mask-image is well-supported; keep the same SVG path; verify Chrome/Safari/Firefox |
| `.ground-dark` on the menu changes an unintended token | Low | Low | The menu is a leaf; verify link/border/bg unchanged in the browser |

### Effort
Complexity: Low-Medium. Time: 2-3 h incl. the visual pass. Files: 3-4.

---

## Plan 3 — a11y + maintainability polish

### Objective
Close the remaining small a11y items (contradictory toggle announcement, no
`aria-current`, sub-3:1 toggle border) and the stale-comment / coupling / scroll-perf
maintainability items. Turns ~8 findings green.

### Step-by-step
1. [16 L a11y] MotionToggle announcement: the button swaps its accessible NAME
   ("Pause motion"↔"Resume motion") AND carries `aria-pressed`, so AT announces
   contradictory state. Give it a STABLE accessible name and let `aria-pressed`
   convey on/off: keep the visible label swap but add a fixed `aria-label="Pause
   motion"` (or render the label in a way that the accessible name stays stable),
   `aria-pressed={paused}`. Update `MotionToggle.test.jsx` (Plan 1) accordingly.
2. [17 L a11y] `aria-current` on the active nav link: in `Nav.jsx:120-138` add
   `aria-current={isActive ? 'true' : undefined}` (section + `/story`) so the
   active state isn't visual-only.
3. [17 L a11y] nav-toggle border contrast: `components.css:80` uses
   `--line-strong` (~2.9:1 on the grounds it sits on). Switch to `--control-edge`
   (the ≥3:1 token #40/#53 already use for `.motion-toggle`).
4. [14 L] Fx header contract comment (`fx.jsx:7-8,10-20`): reword the "routes
   that never animate" claim to the accurate "routes without [data-split]/[data-draw]
   never fetch the plugin chunk" (only /signal mounts no Fx), and extend the API
   doc block with the undocumented hooks (`data-cells`, `data-tilt`, the `.mosaic`
   drift, and the `data-draw-start/end/scrub` tunables). Comment-only.
5. [14 L] `.mosaic` parallax → `data-drift`: `Mosaic.jsx` emits `data-drift`
   alongside its existing `data-cells`; `fx.jsx:63` selects `[data-drift]` instead
   of `.mosaic`. Removes the lone class-keyed hook so Fx owns a uniform `data-*`
   contract (covers both the arch + the duplicate consistency finding).
6. [17 L perf] overDark via IntersectionObserver: `Nav.jsx:46-64` polls
   `getBoundingClientRect()` every scroll frame. Replace with an IntersectionObserver
   on the `#network` hero (threshold at the nav height) that sets `overDark` from
   `isIntersecting` — drops the per-frame layout read. Keep the resize path or let
   the observer + a light resize handler cover it. Verify the treatment still
   flips at the hero boundary on scroll.
7. [19 L] usePageMeta docblock (`usePageMeta.js:33-40`): the comment describes the
   pre-refactor client/static boundary imprecisely — reword to state exactly which
   routes are prerendered vs client-only and that the hook syncs the hydrated head.
   Comment-only.

### File & code changes
| Action | File | Change |
|---|---|---|
| Modify | `src/components/MotionToggle.jsx` | stable accessible name + aria-pressed |
| Modify | `src/components/Nav.jsx` | aria-current; overDark → IntersectionObserver |
| Modify | `src/components/Mosaic.jsx` + `src/lib/fx.jsx` | `.mosaic` → `data-drift` |
| Modify | `src/styles/components.css` | nav-toggle border → `--control-edge` |
| Modify | `src/lib/fx.jsx`, `src/lib/usePageMeta.js` | comment/docblock corrections |

### Testing & validation
`npm run test:fe` (the MotionToggle + Nav tests from Plan 1 assert the aria + the
active state). Manual: VoiceOver/keyboard pass on the mobile menu (aria-current
announced, toggle name stable across presses); the overDark treatment still flips
at the hero edge; the mosaic drift still runs. Rollback: revert.

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| IntersectionObserver threshold mis-tuned vs the old bottom>72 check | Med | Low | Match the existing 72px boundary via rootMargin; verify the flip point in-browser |
| data-drift rename misses a consumer | Low | Low | grep `.mosaic` usage; only fx.jsx selects it for the tween (CSS keeps the class for styling) |
| aria-label stable name diverges from visible text | Low | Low | Keep both in sync; the toggle's job is conveyed by aria-pressed |

### Effort
Complexity: Low. Time: 2-3 h. Files: ~6.

---

# MISSION BRIEF

Overview: the 25 remaining Category F items — all Medium/Low polish — across a
test batch (the site's busiest untested code + 3 tiny resilience fixes), a
token single-source batch, and an a11y+maintainability batch. No Highs remain
in the 27-feature inventory; nothing here is user-blocking.

Execution order (each independent; this order front-loads value):
  1. Plan 1 (tests) — biggest safety value; locks in the #54 a11y fix
     (opacity-not-autoAlpha) and covers Fx/pointer/MotionToggle/Nav. Its
     MotionToggle + Nav tests are consumed by Plan 3's assertions.
  2. Plan 3 (a11y + maintainability) — small, real a11y wins; sequence after
     Plan 1 so its aria changes land against existing tests.
  3. Plan 2 (tokens) — pure cleanup, visual-diff gated; any time.

Decision points:
  - Mobile-menu tokens: add `.ground-dark` to the open `<ul>` (recommended,
    one JSX line) vs referencing dark-resolved tokens in CSS.
  - Pointer reduced-motion: consolidate onto the one-shot `prefersReducedMotion()`
    (recommended, matches current behavior) vs upgrading to live `useReducedMotion`
    (bigger — would tear down pointer listeners on a mid-session flip; out of scope).
  - Split into 3 PRs (recommended — test / a11y / tokens review cleanly apart) or
    one "Category F cleanup" PR.

Total estimated effort: 8-12 hours across ~15 files, 3 PRs, no deploys beyond
the ordinary merge.
