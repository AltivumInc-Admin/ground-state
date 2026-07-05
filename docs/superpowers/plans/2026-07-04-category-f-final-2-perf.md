# Category F — the final 2 Performance items (plan, 2026-07-04)

Source: the two still-open Category F findings in `docs/feature-optimization.md`
(both Performance, both Low, never covered by the earlier 3 plans). Closing them
completes all 31 Category F findings and the entire 27-feature inventory. One
small PR.

---

## Item 1 — /story stops fetching DrawSVGPlugin it never uses (feature 14)

### Objective
`fx.jsx` guards the plugin load with a combined check but then fetches BOTH
`SplitText` and `DrawSVGPlugin` all-or-nothing. `/story` has only `[data-split]`,
so it pulls the `DrawSVGPlugin` chunk (~2 kB gz) + an extra request it never
uses. Gate each import on its own selector.

### Step-by-step
1. In `fx.jsx`, replace `Promise.all([import('gsap/SplitText'), import('gsap/DrawSVGPlugin')])`
   with per-selector imports: `splitEls.length ? import('gsap/SplitText') : null`
   and `drawEls.length ? import('gsap/DrawSVGPlugin') : null` (a `null` slot
   resolves to `null` in `Promise.all`).
2. In the `.then`, read `SplitText = splitMod?.SplitText` / `DrawSVGPlugin =
   drawMod?.DrawSVGPlugin`; `gsap.registerPlugin(...[SplitText, DrawSVGPlugin].filter(Boolean))`.
3. Leave the `splitEls.forEach` / `drawEls.forEach` bodies unchanged — each only
   iterates when its selector matched, i.e. exactly when its plugin was loaded,
   so a missing (null) plugin is never referenced. The outer
   `if (!splitEls.length && !drawEls.length) return restoreCounts` gate stays.

### Verification
- `npm run build`; then load `/story` in the browser and confirm via the
  network panel that **no `DrawSVGPlugin-*.js` chunk is requested** (the landing
  `/` still fetches both). Split-title reveal on `/story` still plays.

---

## Item 2 — Magnetic buttons measure the rect once, not every frame (feature 15)

### Objective
`magnetic.js`'s per-hover `move` handler calls `btn.getBoundingClientRect()` on
every `pointermove` — a forced reflow each frame, while GSAP is transforming the
same element. Measure once on `pointerover` and close over it.

### Step-by-step
1. In the `pointerover` handler, after `btn.dataset.magnet = '1'`, capture
   `const r = btn.getBoundingClientRect()` (the button is at/near its resting
   transform on entry — this is the home rect the pull should be relative to).
2. Drop the `const r = btn.getBoundingClientRect()` from inside `move`; use the
   captured `r`. `move` becomes pure arithmetic + `quickTo` calls.

### Verification
- `npm run test:fe` (the magnetic gating/behavior test still passes — it asserts
  `quickTo` is called, unaffected). Manual: a `.btn` still leans toward the
  cursor and springs back. Measuring at rest also removes a feedback wobble
  (measuring the mid-pull rect fed the transform back into itself).

---

## File & code changes
| Action | File | Change |
|---|---|---|
| Modify | `src/lib/fx.jsx` | per-selector plugin imports; register only resolved |
| Modify | `src/lib/magnetic.js` | measure rect once on pointerover |

## Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A draw-only future route now skips SplitText, or vice-versa | Low | Low | Symmetric per-selector gate; each forEach only runs when its plugin loaded |
| Cached rect goes stale if the user scrolls mid-hover | Low | Low | Button hovers are brief; the finding accepts one measurement; the resting rect is the correct reference anyway |

## Effort
Complexity: Low. Time: ~45 min incl. the /story network check. Files: 2.

# MISSION BRIEF
Two small Performance fixes that close the last 2 Category F findings — /story
drops an unused ~2 kB plugin chunk, magnetic stops a per-frame reflow. One PR;
no deploys beyond the ordinary merge. After this, all 31 Category F findings and
the full 27-feature inventory are resolved.
