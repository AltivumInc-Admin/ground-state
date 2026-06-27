---
target: the Signal archive (src/pages/Signal.jsx)
total_score: 35
p0_count: 0
p1_count: 0
timestamp: 2026-06-27T05-36-16Z
slug: src-pages-signal-jsx
---
# Critique (re-run) — The Signal archive (`src/pages/Signal.jsx` + `SignalIssue.jsx`)

Second run, after the contrast / subscribe / reading-measure fixes (commit `b0b7cec`).

## Design Health Score

| # | Heuristic | Score | Δ | Note |
|---|-----------|-------|---|------|
| 1 | Visibility of System Status | 4 | +1 | The shared subscribe form adds a verified interactive feedback loop (sending/sent/error/preview + live region) where the page had none |
| 2 | Match System / Real World | 4 | — | Editorial newsletter conventions |
| 3 | User Control and Freedom | 3 | — | "All issues" + breadcrumb; no search/filter |
| 4 | Consistency and Standards | 4 | — | One token system; sand now uses --sand-ink on light grounds |
| 5 | Error Prevention | 3 | — | Unknown slug → redirect to /signal |
| 6 | Recognition Rather Than Recall | 4 | — | Dated list, breadcrumb, clear titles |
| 7 | Flexibility and Efficiency | 3 | — | Still no search / RSS / pagination as the archive grows |
| 8 | Aesthetic and Minimalist Design | 4 | +1 | The faint-date blemish is gone — every element is legible; reading measure tightened |
| 9 | Error Recovery | 3 | — | Missing issue → redirect; back link |
| 10 | Help and Documentation | 3 | — | Self-explanatory; minimal |
| **Total** | | **35/40** | **+2** | **Good — bordering Excellent; P1 resolved** |

The +2 is honest: two scored heuristics moved (the resolved contrast blemish lifts #8; the verified subscribe form lifts #1). The headline, though, is that the **P1 WCAG failure is gone** — that's not a rubric point, it's the gate.

## Anti-Patterns Verdict

**Not AI-generated** — unchanged distinctive system. CLI detector clean (`[]`, now including the new `SignalSubscribe` component). The contrast failure that defined the baseline is resolved; measured directly on the rendered pages.

## What Changed (33 → 35)

- **[was P1 — resolved] Sand-on-light contrast.** Added `--sand-ink` (sand pressed for the light ground; raw sand on `.ground-dark`). Measured after: archive dates **2.22 → 5.19:1**, subscribe kicker **→ 5.53:1**, both clearing AA. The landing's dark-ground sand is **unchanged at 8.01:1**.
- **[was P2 — resolved] No subscribe affordance.** Extracted a shared `SignalSubscribe` (the harden-proven form, copy via props) and placed it on the archive (below the list / leading out of the empty state) and at the end of every issue. Real submit verified (dev → preview state); the landing CTA now uses the same component and renders identically.
- **[was P3 — resolved] Reading measure.** `.issue-body` capped to 38rem → **~85ch → ~72ch** (mobile already fine).
- **[was P3 — resolved] Empty state.** No longer dangles on a "sign up" with no affordance — the subscribe block sits directly below it.
- **[kept] In-article subhead case.** Left uppercase to honor the documented Display-Caps brand rule (a one-line change if ever wanted).

## Remaining

No P0/P1/P2. The only open notes are forward-looking and unprompted by the brief: as the archive grows past a handful of issues it may want search / tags / RSS (Flexibility), and the in-article subhead case remains a deliberate brand choice. The `THREE.Clock` console warning is an upstream R3F deprecation (not present on these routes anyway).

## Net

The Signal surface moves to **35/40**, matching the landing's tier, with its blocking accessibility defect resolved and its conversion gap closed.
