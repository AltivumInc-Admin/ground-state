# Category F — the 5 most impactful Medium refinements (plan, 2026-07-04)

Source: Category F audit (features 14-20) in `docs/feature-optimization.md`. The
one High (mobile-menu dialog) shipped as #53. These are the 5 highest-impact of
the 30 remaining Medium/Low items — chosen for real user/crawler impact, not
ease: one every-visitor visual defect, two cross-cutting a11y fixes, one WCAG
Level-A fix, and one safety-net test for the site's highest-stakes untested
behavior. All independent; can share one PR or split.

---

## Plan 1 — Nav dark-treatment prerender FOUC (feature 17) — every-visitor visible

### Objective
Every prerendered non-landing route (`/story`, `/apply`, `/signal`, `/signal/:slug`)
ships a **black nav bar with near-white text** in its static HTML that flips to
the correct light treatment only after JS hydrates — a visible flash on first
paint for every visitor to those pages. Seed the treatment from the route so the
static HTML is correct immediately.

### Prerequisites
- Verified: `src/entry-static.jsx` renders each route through
  `StaticRouter location={route.path}` (`scripts/prerender.mjs:133`), so
  `useLocation().pathname` is the real path at prerender time — the seed will
  evaluate correctly per route.
- Read: `src/components/Nav.jsx:14-20,41-45,89`.

### Step-by-step
1. Move the `useLocation()`/`onLanding` derivation above the `overDark` state so
   the seed can use it: keep `const { pathname } = useLocation()` and
   `const onLanding = pathname === '/'` immediately after the `open`/`active`
   state, then change `const [overDark, setOverDark] = useState(true)` to
   `const [overDark, setOverDark] = useState(onLanding)`.
   - Landing (`/`): seeds `true` → dark nav over the black hero (unchanged; the
     scroll effect then measures the hero and flips it at the boundary).
   - Non-landing: seeds `false` → light nav in the static HTML, matching the
     ghost-sheet body; the existing `useEffect` (Nav.jsx:41-45) that sets
     `false` when `!onLanding` becomes a confirming no-op, no flash.
2. Leave the scroll/measure effect and everything else untouched.
3. Add a Nav render test (extends the new `Nav.test.jsx`): mounted at `/story`
   under `MemoryRouter`, the `<header>` className does NOT contain `on-dark`;
   mounted at `/`, it DOES. Locks the prerender contract.

### File & code changes
| Action | File | Change |
|---|---|---|
| Modify | `src/components/Nav.jsx` | reorder pathname derivation; seed `overDark` from `onLanding` |
| Modify | `src/components/Nav.test.jsx` | non-landing has no `on-dark`; landing does |

### Testing & validation
`npm run test:fe`; then `GSS_ALLOW_EMPTY_ISSUES=1 npm run build` and grep the
emitted HTML: `grep -o 'class="nav[^"]*"' dist/story.html` must NOT contain
`on-dark` (today it does), while `dist/index.html` must. That grep IS the
acceptance proof. Rollback: revert.

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Landing hydration mismatch (seed vs client) | Low | Low | Both prerender and client seed `pathname==='/'` identically; no mismatch |
| A non-landing route legitimately wants dark nav | Low | Low | None does today (all are light ghost sheets); the effect already forces false for all `!onLanding` |

### Effort
Complexity: Low. Time: 30-45 min. Files: 2.

---

## Plan 2 — Reveal-pending content stays in the a11y tree (feature 14) — cross-cutting a11y

### Objective
`data-fade`/`data-stagger` hold pre-reveal content at `autoAlpha:0` =
`visibility:hidden`, removing it from the accessibility tree AND the tab order —
so below-the-fold CTAs (the primary "Apply for membership" Link), the seven FAQ
`<details>`, the whole SignalSubscribe form, each pricing-tier CTA, and the
entire `/apply` form on mobile are unreachable by keyboard and invisible to
screen-reader element navigation until a pointer/PageDown scroll reveals them.
Because `MOTION_OK` gates these tweens, this hits precisely non-reduced-motion
keyboard and SR users. Keep the identical visual reveal but stop removing the
content from the tree.

### Prerequisites
- Read (done): `src/lib/fx.jsx:31-49` (the two handlers) and the decorative
  paths to leave alone — `data-cells` (~:54, aria-hidden Mosaic) and draw dots
  (~:160).
- Understand the self-heal: with `opacity:0` (visibility stays visible), a Tab
  landing on a still-transparent control makes the browser scroll it into view,
  which fires the `once` ScrollTrigger and plays the reveal — the system
  self-corrects for exactly the users currently locked out. SR element nav lists
  the content because it is in the tree.

### Step-by-step
1. `fx.jsx:33` (data-fade tween): change `autoAlpha: 0` → `opacity: 0`.
2. `fx.jsx:43` (data-stagger tween): change `autoAlpha: 0` → `opacity: 0`.
3. Leave `autoAlpha` on the decorative buckets (data-cells, draw dots) — a11y-
   tree removal is harmless there and the paint-skip is a real perf nicety.
4. Add a one-line comment at each site noting the interactive reveal buckets use
   opacity (not autoAlpha) deliberately so pre-reveal content stays focusable/AT-
   visible — prevents a future "optimize to autoAlpha" regression.
5. Test (extend `src/sections/*.test.jsx` or a new `fx` behavior test): under a
   motion-OK matchMedia override, a `data-fade` element containing a link is NOT
   `visibility:hidden` after mount (assert computed `visibility !== 'hidden'`),
   and its child link is present in the tree. (This doubles as the first crack
   at feature 14's separate "Fx untested" item.)

### File & code changes
| Action | File | Change |
|---|---|---|
| Modify | `src/lib/fx.jsx` | `autoAlpha:0` → `opacity:0` on the data-fade + data-stagger tweens; explanatory comments |
| Modify/Create | a `*.test.jsx` | reveal-pending link stays AT-visible under motion-OK |

### Testing & validation
`npm run test:fe`. Manual (real browser, keyboard, motion NOT reduced): load
`/`, Tab through — the "Apply for membership" CTA and FAQ disclosures are
reachable and the reveal plays as focus scrolls to them; on `/apply` (mobile
width) the form is reachable by Tab without scrolling first. Rollback: revert.

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A control briefly focusable while transparent (opacity 0) | Med | Low | Intended: focus self-heals the reveal; the window is only for off-screen content, and Tab scrolling to it fires the tween. Net far better than being unreachable |
| Visual reveal changes | Low | Low | opacity 0→1 is the same fade; only `visibility` is dropped from the from-state |
| Decorative paths regress | Low | Low | Only the two interactive buckets change; data-cells/draw keep autoAlpha |

### Effort
Complexity: Low. Time: 1-1.5 h incl. the keyboard pass. Files: 2.

---

## Plan 3 — Live mid-session reduced-motion (feature 16) — WCAG motion

### Objective
`prefersReducedMotion()` is a one-shot `matchMedia` read; the three JS consumers
(HeroScene, BlochFigure, MotionToggle) freeze it at mount, so a visitor who flips
the OS "Reduce motion" setting *while the page is open* silences everything
(the `.el-excite` CSS gate and all Fx scroll motion revert live) EXCEPT the two
perpetual WebGL scenes the feature exists to govern. Bring the JS consumers up to
the live-response behavior the rest of the system already has.

### Prerequisites
- Read: `src/lib/motion.js` (the existing `useMotionPaused` `useSyncExternalStore`
  pattern to mirror + `prefersReducedMotion`), `src/lib/motion.test.js`, and the
  three consumers: `HeroScene.jsx:21`, `BlochFigure.jsx:31-34`, `MotionToggle.jsx:20`.

### Step-by-step
1. Add `useReducedMotion()` to `motion.js`, built exactly like `useMotionPaused`:
   `useSyncExternalStore(subscribe, get, () => false)` where `subscribe` adds a
   `change` listener on `matchMedia('(prefers-reduced-motion: reduce)')` and
   `get` returns its `.matches`. SSR snapshot `false`. Guard `matchMedia`
   existence for the prerender (`typeof window`/`window.matchMedia`).
2. `HeroScene.jsx:21`: replace `const [reduced] = useState(prefersReducedMotion)`
   with `const reduced = useReducedMotion()`. The scene already re-renders on
   prop change; a live flip now switches it to the static frame.
3. `BlochFigure.jsx:31-34`: drop the mount-only `setReduced(prefersReducedMotion())`
   and use `const reduced = useReducedMotion()` directly (remove the now-dead
   `reduced` state + its effect line).
4. `MotionToggle.jsx:20`: replace the inline `prefersReducedMotion()` check with
   `useReducedMotion()` so the toggle's hide-under-reduced-motion re-evaluates
   live.
5. Keep `prefersReducedMotion()` exported (Cursor/magnetic's separate one-shot
   checks are a different, out-of-scope Low item; don't touch them here).
6. Test in `motion.test.js`: render a probe using `useReducedMotion()`, dispatch
   a `change` on the media query (or swap `matchMedia` + fire the stored
   listener), assert the hook value flips — mirroring the existing pause test.

### File & code changes
| Action | File | Change |
|---|---|---|
| Modify | `src/lib/motion.js` | add `useReducedMotion()` store hook |
| Modify | `src/components/figures/HeroScene.jsx` | frozen useState → hook |
| Modify | `src/components/figures/BlochFigure.jsx` | mount-effect sample → hook |
| Modify | `src/components/MotionToggle.jsx` | inline check → hook |
| Modify | `src/lib/motion.test.js` | hook flips on media change |

### Testing & validation
`npm run test:fe`. Manual (browser DevTools "Emulate prefers-reduced-motion")
WHILE the hero is on screen: toggling reduce mid-session must freeze the hero
cloud and the Bloch precession (not only on reload). Rollback: revert.

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Extra re-renders from the new subscription | Low | Low | Only fires on the rare OS media change; identical mechanism to useMotionPaused already in use |
| BlochFigure state removal breaks its render gate | Low | Med | `showScene` recomputes from `reduced` each render; verify the WebGL/hasWebGL effect is untouched; existing BlochFigure.test.jsx guards the fallback |

### Effort
Complexity: Low-Medium. Time: 1.5-2 h. Files: 5.

---

## Plan 4 — Footer byline link affordance (feature 18) — WCAG 1.4.1 Level A

### Objective
The E-E-A-T "Christian Perez" link in the footer byline inherits `--ink-mute`
from its paragraph with no underline, weight, or color delta — 1.0:1 vs the
surrounding text, so mouse/touch users cannot perceive it is a link (WCAG 1.4.1
"Use of Color", Level A). Add a non-color link cue, reusing the footer's own
existing link-styling pattern.

### Prerequisites
- Read (done): `Footer.jsx:21` (the inline link), `components.css:1705-1710`
  (`.footer-tag` = `--ink-mute`, no descendant `a` rule), and the sibling
  `.footer-links a` pattern (`components.css:1727-1737`).

### Step-by-step
1. Add a `.footer-tag a` rule in `components.css` next to `.footer-tag`: an
   always-on `text-decoration: underline; text-underline-offset: 3px;` (always-on
   because it is an inline link in prose, unlike the list where position implies
   linkness), a resting `color: var(--ink-soft)` (distinct from the paragraph's
   `--ink-mute`), and a `.footer-tag a:hover` raising to `color: var(--ink)`
   (mirroring `.footer-links a:hover`).
2. Verify contrast of `--ink-soft` on the footer ground (footer is
   `.ground-dark`): confirm ≥4.5:1 for the link text from the actual token
   values; the underline is the primary 1.4.1 cue regardless.

### File & code changes
| Action | File | Change |
|---|---|---|
| Modify | `src/styles/components.css` | add `.footer-tag a` + `:hover` |

### Testing & validation
Visual: the "Christian Perez" link is underlined and distinct at rest on the
footer's dark ground; hover raises it. No JS/test change (pure CSS on a static
byline). Rollback: revert.

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Underline clutters the byline visually | Low | Low | Matches the house's own footer-links treatment; a single short name |

### Effort
Complexity: Low. Time: 20-30 min. Files: 1.

---

## Plan 5 — usePageMeta robots/noindex reset test (feature 19) — SEO safety net

### Objective
`usePageMeta` rewrites the robots meta on every route change (noindex pages →
`noindex, follow`; indexable routes → `ROBOTS_INDEX`). That per-route reset is
what stops a noindex page (Confirm/Welcome/Activate/a noIndex issue) from leaking
`noindex` onto the homepage on SPA navigation and deindexing the site — yet it
has zero runtime DOM coverage. A plausible "only write robots when noindex"
refactor would silently ship and deindex the homepage. Add the guard test.

### Prerequisites
- Read: `src/lib/usePageMeta.js:39,43-44,66-73` (the robots write + create-if-
  missing) and `usePageMeta.test.jsx:48-67` (the existing OG/Twitter reset pair
  to mirror) and `:94-95` (the static-string robots assertion to complement,
  not replace).

### Step-by-step
1. In `usePageMeta.test.jsx`, add a rendered-hook test group mirroring the
   OG/Twitter reset pattern:
   1.1. Render a probe using `usePageMeta({ noindex: true, ... })`; assert
        `document.querySelector('meta[name=robots]').content === 'noindex, follow'`.
   1.2. Re-render (or a second probe) with an indexable route (no noindex);
        assert robots resets to the `ROBOTS_INDEX` constant — THE leak guard.
   1.3. With a seeded head that omits the robots tag, assert the create-if-
        missing branch (usePageMeta.js:66-71) appends one with the right content.
2. Match the file's existing render harness (how it mounts the hook + seeds the
   head); do not weaken the existing `:94-95` index.html string check — add
   alongside it.

### File & code changes
| Action | File | Change |
|---|---|---|
| Modify | `src/lib/usePageMeta.test.jsx` | noindex write, reset-to-index leak guard, create-if-missing |

### Testing & validation
`npm run test:fe` green with the 3 new assertions. Rollback: revert (test-only,
no runtime surface). Verify the tests FAIL if the robots write is guarded behind
`if (noindex)` (temporarily, to prove the guard bites).

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Test couples too tightly to head-seeding internals | Low | Low | Mirror the existing OG/Twitter test's exact harness |

### Effort
Complexity: Low. Time: 45 min-1 h. Files: 1.

---

# MISSION BRIEF

Overview: the five highest-impact remaining Category F refinements — one
every-visitor FOUC, two cross-cutting a11y fixes, one WCAG Level-A cue, and one
SEO safety-net test — all Medium, all independent, no new dependencies.

Execution order (impact-first, and each self-contained):
  1. Plan 1 (Nav FOUC) — visible to every non-landing visitor; the grep-the-HTML
     acceptance is unambiguous. Also extends the Nav.test.jsx just shipped.
  2. Plan 2 (reveal a11y) — conversion-path content unreachable by keyboard/SR;
     the one-word tween change with a keyboard-verified acceptance.
  3. Plan 3 (live reduced-motion) — WCAG motion; the largest diff (5 files).
  4. Plan 4 (footer link) — WCAG A, trivial CSS.
  5. Plan 5 (robots test) — a safety net for the highest-stakes untested behavior.

Decision points:
  - Plan 2: the one-word `autoAlpha→opacity` change (recommended) vs a
    `focusin`-completes-the-tween listener — the finding argues the tween change
    is smaller AND covers SR element navigation, which focusin does not.
  - Bundle as one PR (coherent "Category F a11y + polish" batch) vs split
    Plan 3 out (it has the widest surface). Recommended: one PR; all are small
    and independently reverted.

Total estimated effort: 4.5-6 hours across ~8 files. No deploys beyond the
ordinary merge → Amplify build.
