---
name: The Ground State Society
description: A quantum-fluent private prospectus — ghost editorial sheets alternating with black architectural panels.
colors:
  ghost: "#f7f7ff"
  powder: "#c1d8e2"
  sand: "#b7a781"
  umber: "#432d16"
  panel-black: "#08080a"
  black-raised: "#101014"
  black-deep: "#050507"
  bg-raised: "#ffffff"
  bg-deep: "#ebedf5"
  accent-slate: "#4a6878"
  accent-display: "#6e8c9e"
  error-ink: "#a8463f"
typography:
  display:
    fontFamily: "'Archivo Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(2.2rem, 8vw, 7.8rem)"
    fontWeight: 840
    lineHeight: 0.93
    letterSpacing: "0.005em"
    fontVariation: "'wdth' 122"
  headline:
    fontFamily: "'Archivo Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(2rem, 1.2rem + 3.1vw, 3.7rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.005em"
    fontVariation: "'wdth' 116"
  title:
    fontFamily: "'Archivo Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(1.15rem, 1.05rem + 0.5vw, 1.45rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 108"
  body:
    fontFamily: "'Archivo Variable', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "clamp(1rem, 0.96rem + 0.2vw, 1.0625rem)"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: "'IBM Plex Mono', 'SF Mono', Menlo, monospace"
    fontSize: "0.72rem"
    fontWeight: 500
    lineHeight: 1.6
    letterSpacing: "0.18em"
rounded:
  sharp: "0px"
spacing:
  section: "clamp(4rem, 3rem + 4.5vw, 7.5rem)"
  gutter: "clamp(1.25rem, 4vw, 3rem)"
  nav: "4.5rem"
components:
  button-primary:
    backgroundColor: "{colors.panel-black}"
    textColor: "{colors.ghost}"
    typography: "{typography.label}"
    rounded: "{rounded.sharp}"
    padding: "1.05rem 1.9rem"
  button-primary-hover:
    backgroundColor: "{colors.powder}"
    textColor: "{colors.panel-black}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.umber}"
    typography: "{typography.label}"
    rounded: "{rounded.sharp}"
    padding: "1.05rem 1.9rem"
  button-ghost-hover:
    backgroundColor: "{colors.umber}"
    textColor: "{colors.ghost}"
  input:
    backgroundColor: "{colors.bg-deep}"
    textColor: "{colors.umber}"
    rounded: "{rounded.sharp}"
    padding: "0.9rem 1rem"
  input-focus:
    backgroundColor: "{colors.bg-raised}"
    textColor: "{colors.umber}"
  card-tier:
    backgroundColor: "{colors.ghost}"
    textColor: "{colors.umber}"
    rounded: "{rounded.sharp}"
    padding: "1.9rem 1.7rem"
  card-tier-featured:
    backgroundColor: "{colors.ghost}"
    textColor: "{colors.umber}"
    rounded: "{rounded.sharp}"
    padding: "1.9rem 1.7rem"
---

# Design System: The Ground State Society

## 1. Overview

**Creative North Star: "The Ground State"**

The ground state is the lowest-energy, most stable configuration a quantum system can
occupy — |0⟩, settled by construction. The interface is built to feel like that state.
Energy can be fed in (scroll feeds the hero's particle cloud), but the resting condition
is calm: sharp edges, hairline rules, generous silence, nothing vibrating for attention.
Where a mass-market page would shout, this one settles. Restraint is not a constraint on
the brand; it *is* the brand, and the audience — funded quantum founders who can read the
physics — reads that restraint as confidence and competence.

Structurally the system alternates two grounds: **ghost editorial sheets** (a near-white
reading surface for argument and evidence) and **black architectural panels** (the hero,
the Proof data panel, the Final CTA, the footer). Every color flows through semantic
tokens that re-resolve per ground, so a single component renders correctly on either
without per-component color rules. The label layer is set in IBM Plex Mono — nav, kickers,
captions, data — against wide, heavy Archivo display caps, giving the page the cadence of
a precise technical document rather than a marketing site. Physics notation (ħω, |0⟩, α,
β, |ψ₀|²) is treated as meaning, never ornament, and is the one thing exempt from the
uppercase transform: case is information.

This system explicitly rejects mass-market SaaS marketing — no popups, no countdown
timers, no fake scarcity, no exclamation points, no emoji, no gradient text, no
glassmorphism, no decorative drop shadows. It also rejects decorative pseudo-science:
quantum imagery is physically honest or it is not shipped.

**Key Characteristics:**
- Dual-ground architecture: light Ghost sheets and black panels, one token set, AA on both.
- Strict 60 / 20 / 10 / 10 palette discipline — Ghost / Powder / Sand / Umber, plus black.
- Sharp corners everywhere (0px radius); structure drawn with hairlines, not shadows.
- Mono label layer (IBM Plex Mono) against wide architectural Archivo display caps.
- Calm at rest; motion is energy fed in, then relaxation back to the ground state.
- Receipts, not hype: every number is evidence, presented with documentary restraint.

## 2. Colors

A four-color discipline on two grounds: a cool powder accent and a warm sand secondary,
carried over a ghost-white reading sheet and a near-black architectural panel, with umber
as the warm ink that ties them together.

### Primary
- **Powder** (`#c1d8e2`): The 20% accent — a cool, pale slate-blue. It is the brand's
  one voice of emphasis: CTAs on black, highlighted comparison rows, the selected plan,
  stat punchlines, accent panels. On the **dark ground** powder is used directly for text
  and the primary button. On the **light ground** powder is too pale to be legible as
  text, so it appears only as a fill or hairline — its *text* duty is delegated to two
  pressed values below.
- **Accent Slate** (`#4a6878`): Powder pressed toward slate so it reads as text on the
  Ghost ground (5.6:1). Used for small accent text, links, nav-link emphasis, kickers'
  `<strong>`, and form focus rings on light.
- **Accent Display** (`#6e8c9e`): A deeper powder for large text and glyphs only on light
  (3.3:1 — passes AA Large, not AA small). Used for the nav reading-progress bar and
  hovered archive headings.

### Secondary
- **Sand** (`#b7a781`): The 10% warm hairline accent — a muted desert tan. It marks the
  documentary furniture: figure tags (fig. 01–04), source labels, table captions, the
  receipt stamp, footer section headings, warm hairlines and bands. It is the color of an
  archivist's annotation, never of a call to action.

### Neutral
- **Ghost** (`#f7f7ff`): The 60% base canvas — a barely-cool off-white. The light reading
  ground, and the ink/primary-button color on the dark ground.
- **Umber** (`#432d16`): The body ink on light ground — a deep warm brown, not black
  (12.1:1 on Ghost). Its alpha pressings carry the soft/muted text tiers and every
  hairline (`--line` at 14% α, `--line-strong` at 38% α).
- **Panel Black** (`#08080a`): The architectural panel tone — a near-black with a faint
  cool cast. The hero, Proof, Final CTA, and footer grounds; also the light-ground primary
  button fill. Raised (`#101014`) and deep (`#050507`) variants handle surfaces and
  pressed areas on black.
- **Surface Raised** (`#ffffff`) / **Surface Deep** (`#ebedf5`): True white for hovered
  cards and focused inputs on light; a cool pale grey for input rest fills.

### Named Rules
**The 60/20/10/10 Rule.** The palette is rationed: ~60% Ghost, ~20% Powder, ~10% Sand,
~10% Umber, with black as architectural punctuation. These are not loose targets — adding
a fifth hue or letting any accent creep past its share breaks the discipline that makes
the page read as expensive. New surfaces compose from these five only.

**The Dual-Ground Rule.** Never hand-set a dark-mode color. Wrap a region in
`.ground-dark` and let the tokens re-resolve. A component that hard-codes `#08080a` or
`#f7f7ff` instead of `var(--bg)` / `var(--ink)` is a bug — it will break on the opposite
ground.

**The Powder-Is-Not-Text-On-Light Rule.** Raw Powder (`#c1d8e2`) is a fill and a hairline
on the Ghost ground, never text. For accent text on light, use Accent Slate (small) or
Accent Display (large). Powder-as-text is reserved for the black panels, where it clears
13.3:1.

## 3. Typography

**Display Font:** Archivo Variable (with Helvetica Neue, Arial fallback)
**Body Font:** Archivo Variable at normal width (same family, different axis)
**Label/Mono Font:** IBM Plex Mono (with SF Mono, Menlo fallback)

**Character:** One workhorse and one instrument. Archivo's variable width axis does double
duty — pushed wide and heavy (`wdth` 116–122%, weight 800–840) it becomes architectural
display caps with the mass of cut stone; dropped to normal width and weight it is a clean,
quiet body face. IBM Plex Mono is the second voice: the engineer's annotation layer that
labels, captions, and tabulates. The pairing reads as a technical document authored by
someone with taste, not a marketing page.

### Hierarchy
- **Display** (840 weight, `wdth` 122%, clamp(2.2rem → 7.8rem), line-height 0.93,
  uppercase): The wordmark and hero only. Tight leading, near-touching caps; the brand's
  loudest moment, and even it does not exceed ~7.8rem.
- **Headline** (800 weight, `wdth` 116%, clamp(2rem → 3.7rem), line-height 1, uppercase):
  Section titles (`.section-title`), capped at ~19ch measure, `text-wrap: balance`.
- **Title** (700 weight, `wdth` 108%, clamp(1.15rem → 1.45rem), line-height 1.2): Card and
  subsection headings (h3/h4); also the display-set pull statements (quotes, callouts) at
  `wdth` 104%, weight 500.
- **Stat** (820 weight, `wdth` 122%, clamp(2.8rem → 5.3rem)): The Proof panel's big
  numbers and tier/plan prices — display proportions used as data, not headline.
- **Body** (400 weight, normal width, clamp(1rem → 1.0625rem), line-height 1.65): Running
  prose. Measure capped at ~56–66ch (`.lede` 56ch, long-form issue body to 66ch).
- **Label** (500 weight, IBM Plex Mono, 0.72rem, letter-spacing 0.18–0.22em, uppercase):
  The mono layer — nav, kickers, captions, data, source tags, form labels, button text.

### Named Rules
**The Notation-Is-Meaning Rule.** Physics notation (ħω, |0⟩, |ψ₀|², α, β, kets) is exempt
from every `text-transform: uppercase`. Case carries scientific meaning; uppercasing it is
a factual error to this audience. Notation-bearing elements set `text-transform: none`
explicitly (`.scene-ket`, `.scene-caption`, `.b3-ket`).

**The Mono-Label Rule.** Anything that is metadata rather than message — eyebrows, nav
items, captions, table headers, form labels, data — is set in IBM Plex Mono, uppercase,
wide-tracked. Prose and headlines are Archivo. The two never trade jobs.

**The Display-Caps Rule.** Display and headline type is always uppercase Archivo at
`wdth` ≥ 108% and weight ≥ 700. Letter-spacing stays slightly positive (≥ 0.005em) — the
width axis, not negative tracking, supplies the architectural density.

## 4. Elevation

This is a **flat, hairline-drawn system**. Depth is conveyed by 1px rules, tonal ground
shifts (Ghost ↔ white on hover, the black panels themselves), and grid structure — not by
ambient shadows. Surfaces are coplanar; borders do the work that shadows do elsewhere.
There are exactly two intentional shadows in the entire system, and both are graphic
devices rather than depth cues.

### Shadow Vocabulary
- **Receipt Offset** (`box-shadow: 12px 12px 0 rgba(193, 216, 226, 0.55)`): A hard,
  un-blurred powder block offset behind the ROI receipt — it reads as a second sheet of
  paper, a print-shop device, not a floating card.
- **Selected-Plan Ring** (`box-shadow: inset 0 0 0 1px var(--powder)`): An inset powder
  ring that, with a faint powder fill, marks the chosen plan card as "settled" — the
  ground state of the selection. Inset, so it adds no lift.

### Named Rules
**The Flat-By-Default Rule.** No drop shadows for elevation, ever. If a surface needs to
separate from its neighbour, use a hairline (`--line` / `--line-strong`), a ground change,
or whitespace. A blurred shadow under a card is forbidden — it would read as 2014 SaaS.

**The Grain Rule.** A single fixed `feTurbulence` noise layer sits over the whole canvas
at 40% opacity, `mix-blend-mode: soft-light`, pointer-transparent. It is the only texture;
it grounds both the ghost and black surfaces so they read as material, not as flat fills.
Do not add gradients or glows in its place.

## 5. Components

### Buttons
- **Shape:** Sharp — 0px radius (`--radius`), 1px border, mono uppercase label
  (0.78rem, 0.16em tracking), generous padding (1.05rem 1.9rem).
- **Primary:** Solid Panel Black with Ghost text on the light ground; solid Powder with
  black text on the dark ground (`--btn-solid` re-resolves per ground). On hover the fill
  flips to Powder (light) / Ghost (dark) — the button briefly takes the accent.
- **Ghost:** Transparent with a strong hairline border and ink-colored label; on hover the
  fill inverts to solid ink with bg-colored text.
- **Arrow affordance:** `.btn-arrow` glyph translates +4px on hover. Press uses the
  independent `translate` property (0 1px) so it never fights the GSAP magnetic transform.

### Inputs / Fields
- **Style:** Deep cool-grey fill (`--bg-deep`), 1px strong hairline, 0px radius, 0.9rem
  1rem padding. Labels sit above in the mono label style (uppercase, 0.18em tracking).
- **Focus:** Border shifts to Accent Slate and the fill lifts to white (`--bg-raised`);
  on dark it presses to `--black-deep`. No glow.
- **Validation:** Marks appear only after a submit attempt (`.was-validated`); invalid
  borders use a muted oxblood (`#a8463f` light / `#f0b3ac` dark). Select uses an inline
  SVG chevron, not a system control.

### Cards / Containers
- **Corner Style:** Sharp (0px). Always.
- **Background:** The current ground's `--bg`; hover lifts to `--bg-raised`.
- **Border:** Hairline (`--line` or `--line-strong`). Card grids share borders via a
  `1px 1px 0 0` / `0 0 1px 1px` interlock so the grid reads as one ruled table, not
  separated tiles (`.problem-grid`, `.cta-steps`).
- **Shadow Strategy:** None (see Elevation). The featured tier signals itself with a black
  border and a -5px hover lift (`translate`), not a shadow.
- **Internal Padding:** Fluid, ~1.5–1.9rem (`clamp`).

### Navigation
- **Style:** Fixed top bar, hairline bottom border, blurred ghost veil on a pseudo-element
  (so the fixed mobile overlay isn't trapped by the backdrop-filter containing block).
- **Typography:** Mono wordmark and links; active link carries an Accent-Slate underline.
  Over the black hero the bar goes `.on-dark` — veil fades, border goes transparent.
- **Mobile (≤1240px):** Links collapse into a full-screen black overlay; a reading-progress
  hairline (`.nav-progress`, Accent Display) rides the bar's bottom edge, scaled by scroll.

### Signature Components
- **The Bento Hero:** A hairline-framed grid on black — label cells, the giant wordmark,
  and the live R3F ground-state scene cell that zooms out of the bento on scroll to swallow
  the viewport, then dissolves into Problem. Each cell is a `.bx` (1px line, 2.5% ghost
  fill).
- **The ROI Receipt:** A mono-set faux print receipt — dashed rules, dotted leader lines,
  a rotated sand "stamp", the Receipt-Offset powder shadow. ROI total set in Powder. It
  literalizes "receipts, not hype."
- **The Comparison Matrix:** A bordered table where the "us" row is tinted powder
  (`.is-us`). Responsively it either pins its first column and scrolls (matrix) or reflows
  to stacked `data-label` rows (pricing) — nothing is hidden on mobile.
- **The Cursor Reticle:** A four-corner measurement frame that rides a fine pointer and
  springs to lock onto interactive bounds like a viewfinder; `mix-blend-mode: difference`
  keeps it legible on both grounds. Fine-pointer + no-reduced-motion only.
- **The Signal Archive Row:** Whole-row editorial links (mono date in Sand, Archivo
  headline) that nudge their padding-left on hover — restrained motion, no card chrome.

## 6. Do's and Don'ts

### Do:
- **Do** ration the palette to 60/20/10/10 (Ghost / Powder / Sand / Umber) plus black.
  Compose new surfaces from these five only.
- **Do** style through semantic tokens (`--bg`, `--ink`, `--accent`, `--line`) and wrap
  dark regions in `.ground-dark` so they re-resolve. Never hand-set a dark color.
- **Do** keep corners sharp (0px) and draw structure with 1px hairlines.
- **Do** set metadata (eyebrows, captions, data, labels) in IBM Plex Mono uppercase, and
  headlines/body in Archivo. Keep the two layers in their lanes.
- **Do** leave physics notation in its true case (`text-transform: none`). Case is meaning.
- **Do** present every claim as a receipt — sourced, exact, documentary. Use Sand for the
  source/annotation furniture.
- **Do** ship a complete, static page under `prefers-reduced-motion: reduce`; never gate
  content behind a reveal.

### Don't:
- **Don't** use mass-market SaaS marketing patterns: no popups, no countdown timers, no
  fake scarcity, no exclamation points, no emoji.
- **Don't** push cold visitors toward the $300 ask — route them to the free Signal tier.
  The page persuades by being right for the reader, not by pressure.
- **Don't** use gradient text (`background-clip: text`), glassmorphism as decoration, or
  blurred drop shadows for elevation. Depth is hairlines and ground shifts.
- **Don't** put Powder (`#c1d8e2`) as text on the Ghost ground — use Accent Slate
  (`#4a6878`) small or Accent Display (`#6e8c9e`) large.
- **Don't** use Sand (`#b7a781`) as a call-to-action color; it is annotation furniture only.
- **Don't** ship decorative or inaccurate quantum imagery. The figures and the hero scene
  are physically honest or they don't ship.
- **Don't** invent claims — testimonials, member counts, dollar values. Every number traces
  to the strategy document; honesty about launch state is a feature.
