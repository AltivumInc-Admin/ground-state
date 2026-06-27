---
target: the landing page (/)
total_score: 34
p0_count: 0
p1_count: 0
timestamp: 2026-06-27T01-47-35Z
slug: src-pages-landing-jsx
---
# Critique — The Ground State Society landing page (`/`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Scroll-tracked nav, reading-progress hairline, motion-pause controls all present; Signal-form submit feedback not verified live |
| 2 | Match System / Real World | 4 | Speaks the PhD-founder's language natively — correct physics notation, real competitor pricing, "The Round" |
| 3 | User Control and Freedom | 3 | Motion pause (WCAG 2.2.2), reduced-motion path, mobile menu escape; limited control surface (it's a landing) |
| 4 | Consistency and Standards | 4 | One semantic token system across two grounds; energy-level metaphor systematized (|0⟩ → E₀/E₁/E₂ → tiers). Zero drift |
| 5 | Error Prevention | 3 | Signal capture has honeypot + honest-preview-when-unset; little error surface on the landing itself |
| 6 | Recognition Rather Than Recall | 4 | Everything visible — labeled nav, explicit comparison tables, tiers laid bare. No memory burden |
| 7 | Flexibility and Efficiency | 3 | Skip-link, focus-visible rings, anchor nav; linear narrative needs little power-user surface |
| 8 | Aesthetic and Minimalist Design | 4 | The standout. 60/20/10/10 discipline, every element earns its pixel, rich-yet-restrained |
| 9 | Error Recovery | 3 | Quiet WebGL error boundary; inline plain-language form errors (defined, exercised off-landing) |
| 10 | Help and Documentation | 3 | "Fair questions" FAQ answers the skeptical-founder objections directly; figure captions teach the metaphor |
| **Total** | | **34/40** | **Good (high end, bordering Excellent)** |

## Anti-Patterns Verdict

**Does this look AI-generated? No — clearly and at both altitudes.**

**LLM assessment.** Clears the first-order reflex (avoids the quantum-neon-dark-with-glowing-particles cliché — instead light editorial Ghost sheets alternating with black architectural panels, warm umber ink). Clears the second-order reflex: it is *adjacent* to the saturated editorial-typographic lane (mono labels + ruled separators + restraint) but differentiated decisively by a heavy architectural **sans** display (not display-serif/italic), a warm umber palette (not monochrome), the dual-ground black panels, and — most of all — a genuine scientific system doing real conceptual work (the WebGL harmonic well, the energy-level tiers, the Bloch-sphere "applying is the measurement"). It has a POV, a specific audience, and risks strangeness. This is distinctive, ship-grade brand work.

**Deterministic scan.** CLI detector over source: **clean** (`[]`, exit 0). In-DOM overlay: 14 patterns, triaged:
- ~10 `all-caps-body` + 2 `wide-tracking` + 1 `hero-eyebrow-chip` → **false positives**: the deliberate IBM Plex Mono label layer (kickers, captions, source tags, data) — the signature identity, not accidental all-caps body. IBM Plex Mono is on the skill's reflex-reject font list, but it is an **already-committed brand choice**, so identity-preservation wins.
- 2 `low-contrast 1.6:1 sand-on-powder` on table captions → **false positive**: the captions' real composited background is panel black (#08080a), giving sand ~8.4:1. The detector sampled the `.table-wrap` powder edge-glow gradient as the background.
- 4 `repeated-section-kickers` → **judgment call** (see P3 below): defensible as a systematized, nav-linked numbered sequence, but the page's closest brush with the eyebrow trope.
- 1 `layout-transition` (animates `padding-left`) → minor (P3); originates in the Signal-archive hover style.

**Visual overlays.** The detector overlay was injected and rendered in the browser tab during inspection, highlighting the kickers, the mono caps labels, and the table captions.

## Overall Impression

This is one of the most disciplined brand surfaces I've reviewed — it would be hard for anyone to call it AI-made. The conceptual through-line is the rare thing: the brand metaphor (the ground state, |0⟩, lowest-energy-stable-by-construction) is carried *honestly* through the design system — pricing tiers rendered as quantum energy levels with an `hv — apply` excitation photon, applying-as-measurement on a draggable Bloch sphere, "receipts, not vibes" backed by a literal mono receipt and real competitor pricing. Accessibility is genuinely cared for (proper landmarks, single H1 with an `aria-label` that survives the SplitText animation, richly-labeled SVG figures, full reduced-motion path, AA contrast that I measured and confirmed). Responsive down to 390px with no headline overflow.

The biggest opportunity is not visual — it is a trust/IA question: the strongest credibility signal for this skeptical audience (the operator behind the room) lives only in the footer.

## What's Working

1. **The metaphor is load-bearing, not decorative.** Tiers as energy levels, apply-as-measurement, the relaxing particle well — the physics *is* the IA and the persuasion. This is the page's signature and it is executed with scientific honesty (the audience filter the intent doc demands).
2. **Receipts, not hype — literally.** The ROI receipt and the two comparison tables (Hampton $8,500/yr, YPO $10,000+, Vistage $10–20K vs. GSS $3,600/yr; the feature matrix with the "us" row tinted) turn the value claim into checkable evidence. Exactly on-brand.
3. **System discipline across two grounds.** A single token set re-resolves for light Ghost sheets and black panels; the 60/20/10/10 ration holds; the mono-label layer is applied uniformly. Contrast is honest (body/lede 7.05:1, dark-ground labels ~6.9:1).

## Priority Issues

- **[P2] Operator credibility is buried in the footer.** The trust signal a skeptical PhD founder asks for first — *who built this room?* (Christian Perez, founder of Altivum, a Green Beret veteran who builds quantum systems on AWS) — only appears at the very bottom. For a "private room" pitch, that earned authority is doing the most work where it is least likely to be seen.
  - **Why it matters:** the audience's gate is credibility; the page asks them to apply before it shows who is vetting.
  - **Fix:** surface a restrained sliver of operator credibility above the footer (a line in The Ask, or a small "who runs this" note near the application CTA) — without violating the "don't push cold traffic" principle.
  - **Suggested command:** `/impeccable clarify` (or a small structural moment via `/impeccable shape`).
  - *Note: may be an intentional restraint per the intent doc — flag for the user's call.*

- **[P2] The Signal capture's feedback states are unverified.** The email gate is the single conversion micro-interaction on the landing; its loading / success / error / already-subscribed states are the highest-stakes feedback on the page. A success state exists in code, but the live submit path (and its error/duplicate handling) was not exercised in this review.
  - **Why it matters:** a dead or ambiguous submit is the one interaction failure that would cost real conversions here.
  - **Fix:** exercise the real submit end-to-end (success, network error, invalid email, duplicate) and confirm each gives clear inline feedback.
  - **Suggested command:** `/impeccable harden`.

- **[P3] The hero WebGL `<canvas>` is exposed to assistive tech.** It lacks `aria-hidden="true"` and has no label, so a screen reader meets an unlabeled "canvas". The meaning is already carried by the visible `fig. 01` caption, and every SVG figure is exemplarily labeled — the decorative canvas should simply be hidden.
  - **Fix:** add `aria-hidden="true"` to the hero (and Bloch) canvases.
  - **Suggested command:** `/impeccable audit` (a11y) or `/impeccable harden`.

- **[P3] Four repeated numbered section kickers.** Detector-flagged (`02 The Problem … 05 The Ask`). They are defensible — numbered to match the nav and the energy-level metaphor, a real narrative sequence — but they are the one pattern that reads AI-adjacent to a cold eye.
  - **Fix (optional):** decide consciously whether all four need both the number *and* the tracked-caps label, or whether varying the cadence on one makes the system feel authored rather than grammatical.
  - **Suggested command:** `/impeccable typeset` or `/impeccable quieter`.

- **[P3] Mono micro-labels sit at the thinnest contrast margin.** `card-tag`, `nav-tag`, `tier-aud` measure 4.63:1 (pass AA) at ~10px — the smallest, lowest-contrast text on the page.
  - **Fix:** nudge `--ink-mute` slightly toward ink, or bump the ~9.9px tags up 1px, to buy margin for low-vision and dim-screen readers.
  - **Suggested command:** `/impeccable polish`.

## Persona Red Flags

**Jordan (Confused First-Timer):** Largely well-served — the FAQ pre-empts the obvious objections, the free Signal tier is an explicit low-commitment on-ramp, and section labels orient. One snag: the page is dense with domain language by design; a non-quantum visitor is filtered out (intentional), but the "who runs this" answer that would reassure them is footer-only.

**Riley (Deliberate Stress-Tester):** The comparison tables reflow correctly on mobile (pin-and-scroll matrix / stacked pricing), the hero degrades via a WebGL error boundary, reduced motion renders a complete static page. The untested edge: submitting the Signal form with a bad/duplicate/empty email — the recovery path is unverified (see P2).

**Sam (Accessibility-Dependent):** Strong — landmarks, single labeled H1, descriptive SVG figure labels, focus-visible rings, skip-link, full reduced-motion alternative, AA contrast confirmed. The two gaps: the unlabeled hero canvas (P3) and the `A`/`B` group letters folded into H3 accessible names ("A The Room").

**Dr. Mara (project persona — funded quantum founder, time-poor, hype-allergic):** This page is built for her. The physics is correct (she will check), the claims are sourced, nothing shouts. Her one unanswered question on a first skim: *who is in the room and who decides?* — credibility of the operator and the vetting, which the page asserts (vetting "is the product") but does not yet evidence.

## Minor Observations

- `A`/`B` group-label letters are inside the H3 accessible names ("A The Room" / "B The Acceleration"). Consider `aria-label` on the heading or moving the letter out of it.
- `.signal-archive-item` animates `padding-left` (a layout property) on hover — prefer `transform: translateX` to avoid layout work. (Primarily a `/signal` concern; the rule is global.)
- Console carries a `THREE.Clock is deprecated` warning — harmless, but worth migrating to `THREE.Timer` to keep the console clean.

## Questions to Consider

- Would surfacing a restrained sliver of operator credibility above the footer convert more skeptical founders — without crossing the "never push cold traffic" line?
- The numbered-kicker system is systematized; is it pulling its weight on all four sections, or would varying the cadence on one make it feel authored rather than grammatical?
- Is the Signal capture's success/error feedback as considered as the rest of the page?
