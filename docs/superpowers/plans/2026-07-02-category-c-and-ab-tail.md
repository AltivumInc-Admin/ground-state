# Category C refinements + A/B tail — implementation plans (2026-07-02)

Source: `/optimize-features` Category C audit (features 7–8, 8-lens fan-out, 25 raw →
21 verified items, persisted in `docs/feature-optimization.md`) plus the three open/deferred
tail items from Categories A/B. Four plans; execute in order. No new features anywhere —
every step refines what exists.

---

## Plan 1 — Feature 7 batch: hero scene + shared scene infrastructure

### Objective
Close feature 7's verified gaps: give the untested HeroScene wrapper real coverage, stop the
particle sim ramping during the entrance, and eliminate the three drift surfaces (duplicated
wrapper scaffold, hand-copied palette, copy-defined scene primitives) that three lenses
independently flagged. The shared modules built here also unblock Plan 2.

### Prerequisites
- Node 22, `npm ci` done; `npm run test:fe` green at start.
- No new dependencies. All work inside existing stack (React 19, R3F, Vitest/jsdom).
- Read first: `src/components/HeroScene.jsx`, `src/components/figures/BlochFigure.jsx`,
  `src/lib/motion.js`, `src/three/GroundStateScene.jsx`, `src/three/BlochScene.jsx`.

### Step-by-step
1. Shared palette module (Consistency, Medium impact)
   1.1. Create `src/lib/palette.js` exporting `GHOST = '#f7f7ff'`, `POWDER = '#c1d8e2'`,
        `SAND = '#b7a781'`, `BLACK = '#08080a'` with a comment: mirrors
        `src/styles/tokens.css` (`--ghost/--powder/--sand/--black`) — WebGL can't read CSS
        vars; edit both together.
   1.2. In `GroundStateScene.jsx:20-23` and `BlochScene.jsx:13-15` delete the local consts
        and import from `../lib/palette.js`.
2. Shared scene-wrapper scaffold (Architecture, Medium impact)
   2.1. Create `src/components/SceneBoundary.jsx`: one class boundary with
        `fallback = null` default prop (covers HeroScene's null case and BlochFigure's
        `<BlochSphere/>` case).
   2.2. Move `prefersReducedMotion()` into `src/lib/motion.js` (exported; keep the
        `typeof window !== 'undefined'` guard — HeroScene renders during the SSR prerender
        pass).
   2.3. Update `HeroScene.jsx` and `BlochFigure.jsx` to import both; delete the local
        copies (`FigBoundary` becomes `<SceneBoundary fallback={<BlochSphere/>}>`).
3. Defer the sim ramp past the entrance (UX/Performance, Medium impact)
   3.1. In `HeroScene.jsx`, add a `ready` state initialized false; in a mount effect set it
        via `requestIdleCallback(cb, { timeout: 1500 })` with `setTimeout(cb, 300)` fallback
        (Safari has no rIC). Pass `active={inView && ready}` — GroundStateScene already
        renders `frameloop='demand'` + static frame when not active, so pre-ready paint is
        the settled cloud, no visual pop.
   3.2. Cancel the idle callback/timeout on unmount.
4. HeroScene tests (Resilience & tests, Medium impact)
   4.1. Create `src/components/HeroScene.test.jsx`; `vi.mock('../three/GroundStateScene.jsx')`
        with a stub echoing `reduced`/`active` into data-attributes.
   4.2. Tests: (a) matchMedia reduce → `reduced=true`; (b) `setMotionPaused(true)` →
        `reduced=true` (reset store after); (c) stub that throws → boundary renders null,
        no crash (spy console.error to keep output clean); (d) default → `reduced=false`.
5. Low-tail items
   5.1. Context loss (both scenes): in each Canvas `onCreated={({ gl }) => …}` add
        `webglcontextlost` listener (with `preventDefault`) lifting a `failed` flag via a
        prop callback; HeroScene renders null, BlochFigure falls back to `<BlochSphere/>`.
   5.2. Orphaned caption/toggle: lift SceneBoundary's failed state (callback prop) so
        `Hero.jsx` can gate `scene-ket`/`scene-caption`/`MotionToggle` on the scene running.
        (5.1 and 5.2 share the lifted-flag plumbing — do together.)
   5.3. `src/three/shared.js` (or extend palette.js): `clampDt(raw)` and `circleGeometry()`
        helpers; use in both scenes (Well()'s three inline ring loops).
   5.4. Draw-call merge in `Well()`: group the 7 rings (GHOST/0.17) and 4 rails (GHOST/0.26)
        into shared geometry or shared memoized materials (~12 → ~3 draws).
   5.5. One-line comment in `BlochScene.jsx` naming `BlochFigure` as the reduced-motion owner.
   5.6. Move `HeroScene.jsx` → `src/components/figures/HeroScene.jsx`; update the import in
        `src/sections/Hero.jsx` and the mock path in `Hero.test.jsx` + new test file.
   5.7. `.motion-toggle` border: `var(--line-strong)` → `var(--control-edge)`
        (`components.css:306`).

### File & code changes
| Action | File | Change |
|---|---|---|
| Create | `src/lib/palette.js` | Canonical JS palette mirroring tokens.css |
| Create | `src/components/SceneBoundary.jsx` | Shared error boundary, fallback prop |
| Create | `src/three/shared.js` | `clampDt`, `circleGeometry` helpers |
| Create | `src/components/figures/HeroScene.test.jsx` | Wrapper logic tests (4 cases) |
| Modify | `src/lib/motion.js` | Export `prefersReducedMotion()` |
| Modify (move) | `src/components/HeroScene.jsx` → `components/figures/` | Import shared pieces; idle-frame ramp; failed-flag lift |
| Modify | `src/components/figures/BlochFigure.jsx` | Use SceneBoundary + shared probe |
| Modify | `src/three/GroundStateScene.jsx` | Palette import; shared helpers; draw merge; contextlost |
| Modify | `src/three/BlochScene.jsx` | Palette import; clampDt; contextlost; ownership comment |
| Modify | `src/sections/Hero.jsx` | Import path; gate caption/toggle on scene state |
| Modify | `src/sections/Hero.test.jsx` | Updated mock path |
| Modify | `src/styles/components.css` | `.motion-toggle` border token |

### Testing & validation
- `npm run test:fe` — new HeroScene tests + existing suites green.
- `npm run build` — prerender must still emit the hero static markup (SSR-safe guards).
- Manual: `npm run dev` — hero paints, entrance runs, sim ramps after; DevTools →
  "Rendering → Emulate prefers-reduced-motion" shows static frame; Pause motion stops the
  cloud; simulate context loss via `WEBGL_lose_context` extension in console and confirm
  fallback; confirm caption/toggle disappear when scene fails (temporarily throw in scene).
- Rollback: single revert commit; no data/infra surface.

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Idle-frame gate visibly delays first cloud motion | Low | Low | 300ms timeout cap; static settled frame is already the designed pre-motion state |
| Moving HeroScene breaks a stale import | Low | Med | grep for `HeroScene` after move; CI build gate catches it |
| Draw-call merge subtly changes ring opacity stacking | Med | Low | Verify screenshots before/after at same camera; keep per-group opacity identical |
| SSR pass touches window/document in new code | Low | High (build fails) | Keep all probes behind `typeof window` guards; build in CI before merge |

### Dependencies & order
Steps 1–2 first (shared modules; Plan 2 consumes them). 3–4 independent after 2. 5.x last.
Parallelizable: 5.3/5.4 vs 5.1/5.2.

### Estimated effort
Complexity: Medium. Time: 4–6 hours. Files: 4 created, 8 modified.

---

## Plan 2 — Feature 8 batch: physics figures

### Objective
Make the Pause-motion control actually cover every perpetual animation (the one Medium
accessibility gap found), unify the four figures' drawing hand so they render as one plate
set at every breakpoint, fix the WaveDivider draw completing off-screen, and close the
figure test gap.

### Prerequisites
- Plan 1 merged (uses `palette.js` import in BlochScene and the shared boundary; the pause
  DOM mirror below edits the same `motion.js`).
- Read first: `src/components/figures/*.jsx`, `src/sections/WaveDivider.jsx`,
  `src/lib/fx.jsx:130-160`, `src/styles/components.css` figure blocks.

### Step-by-step
1. Pause-store DOM mirror + el-excite gate (Accessibility/Motion, Medium impact)
   1.1. In `src/lib/motion.js`: add `syncDom(v)` → `document.documentElement.toggleAttribute('data-motion-paused', v)`
        guarded by `typeof document !== 'undefined'` (SSR prerender imports this module).
        Call from `setMotionPaused` and once at module load with the localStorage value.
   1.2. In `components.css`, inside the existing `@media (prefers-reduced-motion: no-preference)`
        block at 1864: change selector to `:root:not([data-motion-paused]) .el-excite { animation … }`.
   1.3. Test (in `motion` or figures test file): `setMotionPaused(true)` sets the attribute;
        `false` removes it.
2. One drawing hand for the plates (UI craft, Medium impact)
   2.1. Add `vector-effect="non-scaling-stroke"` to the drawn strokes in `WaveParticle.jsx`,
        `BlochSphere.jsx`, `EnergyLevels.jsx`.
   2.2. Collapse stroke widths to a 3-step scale — guide 1 / line 1.4 / emphasis 1.75 — and
        one dash cadence ('3 5') across the three files; keep `--fig-stroke` as the guide
        token everywhere (EnergyLevels drops `--ink-soft` for strokes).
   2.3. Verify each figure on both grounds at 390px and desktop; adjust the emphasis step
        only if a figure visibly changes hierarchy.
3. WaveDivider scrub retune (UX/Motion, Medium impact)
   3.1. `WaveDivider.jsx:16`: `data-draw-scrub` 2.5 → 1, `data-draw-end` `bottom 22%` →
        `bottom 70%`; update the intent comment at :12 to match the new behavior.
   3.2. Manual scroll test: slow scroll keeps the drawn-out reveal; a fast flick still lands
        with the wave visibly completing in-viewport.
4. Figure tests (Resilience & tests, Medium impact)
   4.1. `src/components/figures/BlochFigure.test.jsx`: default jsdom render → SVG
        `role="img"` (accessible name matches /Bloch sphere/); after `setMotionPaused(true)`
        still the SVG; store reset in afterEach.
   4.2. `src/components/figures/figures.test.jsx`: WaveParticle/EnergyLevels accessible
        names + expected element counts (16 sample dots; 3 levels + hν label); FigCaption
        renders `fig. {num}` + children (and ket branch per step 5 outcome).
5. Low-tail items
   5.1. Suspense fallback in `BlochFigure.jsx:113`: `null` → `<BlochSphere/>`.
   5.2. fig. 01 caption decision: try rendering Hero's caption via `<FigCaption num="01" ket="|society⟩ = α|advantage⟩ + β|access⟩">`
        inside the hero overlay; if `.scene-caption` absolute positioning fights it, keep
        the bespoke markup, delete FigCaption's `ket` prop + `.fig-ket` CSS instead, and
        comment the divergence. One decision, both findings closed.
   5.3. `src/components/figures/ArrowMarker.jsx` (id prop) used in both `<defs>`.
   5.4. Drop "Drag to rotate the view." from the `aria-label` in `BlochFigure.jsx:101`.
   5.5. `fx.jsx:138-139`: single `forEach` bucketing shapes by one `getComputedStyle` read.

### File & code changes
| Action | File | Change |
|---|---|---|
| Modify | `src/lib/motion.js` | DOM mirror (`data-motion-paused`) |
| Modify | `src/styles/components.css` | el-excite gate; stroke/dash tokens; drop `.fig-ket` if 5.2 deletes |
| Modify | `src/components/figures/{WaveParticle,BlochSphere,EnergyLevels}.jsx` | non-scaling-stroke + unified weights/dashes; ArrowMarker |
| Modify | `src/sections/WaveDivider.jsx` | Scrub/end retune + comment |
| Modify | `src/components/figures/BlochFigure.jsx` | Suspense fallback; aria-label |
| Modify | `src/sections/Hero.jsx` (+ maybe `FigCaption.jsx`) | fig. 01 caption decision |
| Create | `src/components/figures/ArrowMarker.jsx` | Shared marker def |
| Create | `src/components/figures/BlochFigure.test.jsx` | Fallback-path tests |
| Create | `src/components/figures/figures.test.jsx` | Pure-figure render tests |
| Modify | `src/lib/fx.jsx` | Single-pass stroke bucketing |

### Testing & validation
- `npm run test:fe` + `npm run build` green; prerendered `/` still contains the figures.
- Manual: Pause motion now freezes hero cloud + Bloch + fig. 03 arrow (the acceptance test
  for the Medium item); figures at 390px show crisp equal-weight hairlines; fast-flick past
  the WaveDivider shows a completing wave.
- Rollback: revert commit.

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| non-scaling-stroke changes the designed look on desktop | Med | Med | Weights chosen to match current desktop rendering of the mid-scale figure; visual pass both grounds before merge |
| `data-motion-paused` attribute set during hydration mismatch | Low | Low | Attribute is on `<html>`, outside React's tree — no hydration concern |
| Scrub retune deadens the divider for slow scrollers | Low | Med | Keep scrub ≥1 (still lags scroll); tune end position in-browser before committing |

### Dependencies & order
Step 1 first (its motion.js edit conflicts textually with Plan 1's — rebase after Plan 1).
2/3/4/5 independent of each other; 4.2's FigCaption assertions depend on 5.2's decision.

### Estimated effort
Complexity: Medium. Time: 3–5 hours. Files: 3 created, 8 modified.

---

## Plan 3 — Feature 3 tail: Signal pages onto the house visual scaffolding

### Objective
`/signal` and `/signal/:slug` render bespoke heads (`signal-archive-head`,
`signal-issue-kicker`) that skip the shared `kicker` + `section-title` system every other
page uses, so house-level typography changes don't reach them. Adopt the shared scaffolding
while keeping the pages' reading-surface calm (no heavy scroll motion).

### Prerequisites
- Prerender markers must survive: `scripts/prerender.mjs` expects `signal-archive` and
  `signal-issue` class strings in the rendered HTML — keep both wrapper classes.
- Read first: `src/pages/Signal.jsx`, `src/pages/SignalIssue.jsx`, `src/styles/base.css:108-161`,
  `components.css:1989-2148`, and `src/sections/Story.jsx` as the reference consumer.

### Step-by-step
1. Archive head (`Signal.jsx:21-24`): add `<p className="kicker">The Signal</p>` above the
   `h1`, give the `h1` `className="section-title"`, keep the lede `p` (add `className="lede"`).
   Keep `signal-archive-head` as the container for the border/padding treatment.
2. Issue head (`SignalIssue.jsx:25-33`): restyle `.signal-issue-kicker` to extend the house
   `.kicker` (apply both classes; the back-link stays inside — `.kicker` is flex so the link
   + hairline compose); title keeps its bespoke clamp (a reading headline, not a section
   title — document this in CSS comment) or adopts `--text-display-sm` if visually equal.
3. CSS dedupe (`components.css`): delete rules the shared classes now cover
   (`signal-archive-head h1` font-size, the mono/letter-spacing block of
   `signal-issue-kicker` at 2118-2125); keep spacing/border rules.
4. Motion: none added — static `kicker` (no `data-fade`/`data-split`) per the reading-surface
   decision; note it in a comment so the omission reads as deliberate.
5. Verify: `npm run test:fe` (Signal tests), `npm run build` (prerender markers + expect
   guards pass), then visual pass on `/signal` and an issue page (use a dev issue via
   `issues.generated.json` if the archive is empty).

### File & code changes
| Action | File | Change |
|---|---|---|
| Modify | `src/pages/Signal.jsx` | kicker + section-title + lede classes |
| Modify | `src/pages/SignalIssue.jsx` | house kicker composition |
| Modify | `src/styles/components.css` | Remove superseded bespoke head rules |

### Testing & validation
- Existing `Signal.empty.test.jsx` / `SignalIssue.test.jsx` still green (they assert
  content, not head classes — verified).
- `scripts/prerender.mjs` build passes (markers intact); visual check both grounds/breakpoints.
- Rollback: revert commit.

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `.kicker`'s flex + ::after hairline fights the issue back-link layout | Med | Low | Compose classes and check; if it fights, keep bespoke kicker on the issue page only and close the archive half |
| Prerender expect-marker breaks | Low | High (build fails) | Wrapper classes untouched; build gate catches regardless |

### Estimated effort
Complexity: Low-Medium. Time: 1–2 hours. Files: 3 modified.

---

## Plan 4 — Deferred pair: evaluate, don't build (recommendation: keep deferred)

### Objective
Honest disposition of the two consciously deferred items so they stop resurfacing:
(a) feature 3's per-slug dynamic import of issue bodies; (b) feature 6's `useVerifiedParam`
hook. Both were deferred with reasons that still hold — this plan records the re-check and
the concrete triggers that would flip them.

### (a) Issue bodies out of the main bundle — KEEP DEFERRED
- Current facts: `src/lib/issues.js:1` statically imports `issues.generated.json`;
  `App.jsx:9-10` imports Signal pages eagerly **by design** (prerendered routes must not
  hydrate through a Suspense fallback — the comment at `App.jsx:13-17` is the governing
  constraint). The archive is still empty, so today's cost is ~0 bytes.
- Why still deferred: a per-slug `import()` would put async data under a prerendered,
  synchronously-hydrated route — exactly the flash the App.jsx comment forbids — so the
  split needs a build-time two-file emit (meta vs bodies keyed by slug) + hydration-safe
  body loading. Real work, zero present benefit.
- Flip triggers (revisit when ANY holds): corpus > ~10 issues, or `issues.generated.json`
  > ~50 kB, or main-chunk growth attributable to bodies in a bundle audit.
- Steps if triggered: emit `issues.meta.json` + per-slug `bodies/<slug>.json` from
  `fetch-issues.mjs`; `getIssueBySlug` returns meta + lazy body; SignalIssue renders header
  from meta immediately and body on resolve (prerendered HTML already carries the full body
  for crawlers/first paint). Effort then: Medium, 3-4 hours.

### (b) `useVerifiedParam` hook — KEEP DEFERRED
- Current facts (re-verified today): `Welcome.jsx` (GET `requestJson`, 6 states, session
  fields, strip-after-verify, keep-param-on-error) vs `Confirm.jsx` (POST `postJson`,
  5 states, 4xx-vs-transient branch, strip-on-invalid-too). The shared shape is ~25 lines;
  the divergences (method, param retention semantics, result payload) would become hook
  parameters — indirection ≥ savings, exactly the #35 judgment.
- Flip trigger: a third URL-param verifier page appears. Then: extract
  `useVerifiedParam(param, verify, {classify})` with the Confirm/Welcome semantics as the
  two test fixtures. Effort then: Medium, 2-3 hours.

### Estimated effort (this plan as-is)
Complexity: Low. Time: 0 hours implementation (documentation of disposition only).

---

# MISSION BRIEF

Overview: Two execution batches close all 8 Medium-impact Category C findings (plus the
low tail) across the hero scene and physics figures; one small batch closes the last open
Category A item (Signal scaffolding); the two deferred items stay deferred with explicit
flip triggers.

Execution order:
1. Plan 1 (Feature 7 + shared infra) — builds palette.js/SceneBoundary/motion.js exports the
   other work consumes.
2. Plan 2 (Feature 8) — the user-facing Medium wins (pause coverage, plate unification,
   WaveDivider); rebase its motion.js edit on Plan 1.
3. Plan 3 (Signal scaffolding) — independent; can run parallel to 1-2 if a second worktree
   is used.
4. Plan 4 — no build; the dispositions above are the deliverable.

Decision points:
- fig. 01 caption: adopt FigCaption (preferred if the overlay layout allows) vs delete the
  dead `ket` path — decided in-implementation (Plan 2, step 5.2).
- WaveDivider retune values are taste-final in-browser; the plan's numbers are starting points.
- Issue-title typography on `/signal/:slug` (keep bespoke clamp vs `--text-display-sm`) —
  visual call during Plan 3.

Total estimated effort: 8–13 hours across 3 implementation batches (+0 for Plan 4).
Suggested PR shape: one PR per plan, mirroring the #26-#35 batch convention.
