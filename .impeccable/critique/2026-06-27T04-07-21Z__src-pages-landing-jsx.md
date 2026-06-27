---
target: the landing page (/)
total_score: 35
p0_count: 0
p1_count: 0
timestamp: 2026-06-27T04-07-21Z
slug: src-pages-landing-jsx
---
# Critique (re-run) — The Ground State Society landing page (`/`)

Second run, after the harden / audit / polish fixes.

## Design Health Score

| # | Heuristic | Score | Δ | Key Issue |
|---|-----------|-------|---|-----------|
| 1 | Visibility of System Status | 4 | +1 | Signal form feedback now verified live + state-machine tested + concurrent-submit guard; the cited gap is closed |
| 2 | Match System / Real World | 4 | — | Speaks the PhD-founder's language natively |
| 3 | User Control and Freedom | 3 | — | Limited control surface (a landing); error→retry preserves input |
| 4 | Consistency and Standards | 4 | — | One token system, two grounds; A/B group letters no longer pollute H3 names |
| 5 | Error Prevention | 3 | — | Honeypot + maxLength + native validation + resubmit guard; small error surface |
| 6 | Recognition Rather Than Recall | 4 | — | Everything visible — labeled nav, comparison tables, tiers |
| 7 | Flexibility and Efficiency | 3 | — | Skip-link, focus rings, anchor nav; linear narrative |
| 8 | Aesthetic and Minimalist Design | 4 | — | 60/20/10/10 discipline; micro-label contrast now 5.53:1 (was 4.63) |
| 9 | Error Recovery | 3 | — | Form error preserves input + retry-in-place; WebGL error boundary |
| 10 | Help and Documentation | 3 | — | "Fair questions" FAQ; figure captions teach the metaphor |
| **Total** | | **35/40** | **+1** | **Good — high end, bordering Excellent** |

The honest delta is +1: the only fix that closed a *scored* heuristic gap was the Signal-form verification (#1). The other fixes were P3s under heuristics already at 4, so they cut the backlog rather than move the rubric.

## Anti-Patterns Verdict

**Still clearly not AI-generated.** Unchanged from baseline — distinctive, load-bearing physics metaphor, dual-ground system, warm umber palette, architectural sans display.

**Deterministic scan:** CLI clean (`[]`). In-DOM overlay vs. the baseline run: the `layout-transition: padding-left` flag is **gone** (archive hover moved to `transform`). The remaining flags are the same already-triaged set:
- `all-caps-body` / `wide-tracking` (the deliberate IBM Plex Mono label layer; an already-committed brand font — identity-preservation wins). False positives.
- `hero-eyebrow-chip` (the `|0⟩ — the lowest-energy state` hero label) — content-bearing, defensible.
- `low-contrast 1.6:1 sand-on-#c1d8e2` on the table captions — **false positive**: real composited background is panel black (~8.4:1); the detector samples the table-wrap's powder edge-glow gradient.
- `repeated-section-kickers` (4) — kept as a deliberate, nav-linked numbered system (your call).

## What Changed Since Baseline (34 → 35)

- **[was P2] Signal capture verified + hardened.** Concurrent-resubmit guard added; `SignalForm` exported and covered by a new state-machine test net (sent / error+preserve / double-submit / preview); confirmed via a **real browser round-trip** (the endpoint received the actual POST; UI showed the success state in the live region). Backend contract verified: duplicate→200 is intentional privacy, not a bug. → lifts Heuristic #1 to 4.
- **[was P3] H3 accessible names cleaned.** `A`/`B` group letters marked `aria-hidden`; AT now reads "The Room" / "The Acceleration".
- **[was P3] Archive hover off the layout path.** `.signal-archive-item` `padding-left`→`transform: translateX`; the `layout-transition` detector flag is resolved.
- **[was P3] Micro-label contrast widened.** Light-ground `--ink-mute` 0.68→0.74 → smallest mono labels 4.63:1 → 5.53:1, hierarchy preserved.
- **[retracted] Hero/Bloch canvas a11y.** False positive — both already correctly handled (hero hidden via wrapper `aria-hidden`; Bloch `role="img"` + descriptive label).

## Remaining (intentional, by your decision)

- **Operator credibility in the footer** — deliberate restraint per the intent doc; left as-is.
- **Numbered section kickers** — kept as a deliberate brand system (mapped to nav + the energy-level metaphor).

## Minor Observations

- The `THREE.Clock is deprecated` console warning is upstream (@react-three/fiber's internal render loop under three 0.184), not our code — track via a future R3F bump, not a polish change.

## Net

No P0/P1. The actionable P2/P3 backlog from the baseline is closed except the two items intentionally kept. The page sits at the top of the "Good" band, bordering "Excellent."
