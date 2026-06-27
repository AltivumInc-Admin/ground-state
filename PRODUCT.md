# Product

## Register

brand

## Users

Funded quantum founders — technical operators building real quantum companies, most
of whom can read the physics on the page and will judge the brand by whether it gets
the science right. They arrive skeptical, having seen the quantum space saturated with
hype, and they are time-poor. Membership ("The Round," $300/month) is vetted by
application; funding stage is not the bar — operating a real quantum company is.

A second audience matters by exclusion: cold or unqualified visitors. They are never
pushed toward the $300 ask. They are routed to the free Signal tier (newsletter +
quantum module), and the design must make that routing feel like generosity, not a
downgrade.

## Product Purpose

A digital front door that makes a funded quantum founder feel they have found the
private room where the quantum economy is actually being built — and apply to enter it.

The page exists to convert qualified founders into applications and to route everyone
else to the free tier. It is not the product; the product (the private network) lives
elsewhere. Success is a qualified founder thinking, on first read, *"finally, a room
built by someone who actually understands my world,"* and applying — while a cold
visitor leaves having subscribed to the Signal rather than bouncing or being coerced.

## Brand Personality

Quiet confidence. The reference is a private bank's prospectus written by someone who
speaks qubits: precise, understated, expensive without saying so. Three words —
**restrained, credible, exact.**

Voice: declarative and unhurried. The physics is real, the claims are receipts, nothing
is shouting. No exclamation points, no emoji, no urgency theatre. Emotional goal on
arrival is recognition and calm authority, not excitement — the feeling of being let
into somewhere serious.

## Anti-references

- **Mass-market SaaS marketing.** No growth-hack patterns: no popups, no countdown
  timers, no fake scarcity, no "limited spots," no exclamation points, no emoji.
  Restraint is the brand, not a constraint on it.
- **Paywall funnels for cold traffic.** The application is for funded founders only;
  unqualified visitors are routed to the free Signal tier, never pressured toward the
  $300 ask.
- **Content sites and web apps.** This is one landing page plus an application form (and
  a small set of supporting routes). No member portal, no login, no dashboard bolted on.
  The Signal archive is the one editorial surface, and it stays subordinate to the front
  door.
- **Hype and invented claims.** No fabricated testimonials, member counts, or dollar
  values. Every number traces to the strategy document. Honesty about what exists at
  launch is a feature, not an apology.
- **Decorative pseudo-science.** Quantum imagery that is wrong, or physics notation used
  as ornament. The figures and the hero scene are scientifically honest or they are not
  shipped.

## Design Principles

1. **Restraint is the brand.** The most premium move is usually the quieter one. Reach
   for less weight, less motion, less color before more. Whitespace and silence read as
   confidence to this audience.
2. **Receipts, not hype.** Every claim, price, and number is sourced from the strategy
   document and presented as evidence — ROI as a receipt, tiers mirrored exactly. If it
   can't be substantiated, it doesn't ship.
3. **Scientific accuracy as the credibility filter.** The audience can check the physics.
   Notation (ħω, |0⟩, α, β, |ψ₀|²) is meaning, not decoration, and is exempt from the
   uppercase display transform — case is information. The figures and the ground-state
   hero are physically honest.
4. **Honesty about launch state.** When an endpoint or feature isn't live, the UI says
   so plainly (the forms' honest preview state) rather than faking it. Transparency is
   part of the trust the page is built to earn.
5. **Route by qualification, never coerce.** Qualified founders are invited to apply;
   everyone else is welcomed to the free tier. The page persuades by being right for the
   reader, not by pressure.

## Accessibility & Inclusion

- **WCAG AA across both grounds.** The strict 60/20/10/10 palette holds AA on the light
  (Ghost) ground and the dark (black architectural panel) ground alike — every color
  flows through semantic tokens that re-resolve per ground. Body Umber-on-Ghost is
  12.1:1; Ghost-on-black 18.6:1; on light ground, accent text uses pressed powders
  (#4A6878 small / #6E8C9E large) because raw powder is text-illegible there.
- **Full reduced-motion path.** All GSAP choreography runs inside
  `prefers-reduced-motion: no-preference`; under reduced motion the page renders complete
  and static, and the hero shows a settled frame. Content is never gated behind a
  reveal animation.
- **Resilient hero.** The WebGL ground-state scene degrades quietly (error boundary) when
  WebGL is unavailable, and suspends its render loop off-screen — the page never depends
  on the canvas to be legible or usable.
