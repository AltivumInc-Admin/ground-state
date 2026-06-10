# The Ground State Society — Landing Page

The landing page for **The Ground State Society**, the private, members-only network for
funded quantum founders ($300/month). Built with React + Vite. Copy is sourced from
`quantum_round_premium_strategy.pdf`; the section structure follows the page blueprint in
`SPA.jpg` (Hero · Problem · Story · Proof · Features · CTA — displayed on the page as
sections 01–06).

## Stack

- [Vite](https://vite.dev/) + [React](https://react.dev/) + [React Router](https://reactrouter.com/)
- [GSAP](https://gsap.com/) (ScrollTrigger, SplitText, DrawSVG) — scroll choreography
- [Three.js](https://threejs.org/) via [React Three Fiber](https://r3f.docs.pmnd.rs/) — the hero's ground-state particle scene (lazy-loaded chunk)
- Self-hosted fonts via Fontsource (Archivo Variable with the width axis, IBM Plex Mono) — no third-party requests
- No CSS framework — hand-written design system in `src/styles/`

## Design system

**Palette** — strict 60/20/10/10 plus black architectural panels:

| Token | Hex | Share | Use |
| --- | --- | --- | --- |
| `--ghost` | `#F7F7FF` | 60% | Base canvas (light ground) |
| `--powder` | `#C1D8E2` | 20% | CTAs, highlights, accent panels |
| `--sand` | `#B7A781` | 10% | Figure tags, source labels, warm hairlines |
| `--umber` | `#432D16` | 10% | Body ink on light ground |
| `--black` | `#08080A` | — | The architectural panel tone (hero, Proof, CTA, footer, figure bands) |

Everything flows through semantic tokens (`--bg`, `--ink`, `--accent`, `--line`, …) defined
in `src/styles/tokens.css`. Dark panels apply the `.ground-dark` class, which re-resolves
the same tokens for black ground — components and SVG figures work on both grounds
unchanged.

Contrast spine (AA throughout): Umber on Ghost 12.1:1; ghost on black 18.6:1; powder on
black 13.3:1; sand on black 8.4:1; button labels ≥ 8.7:1. On light ground, powder is too
light for text, so accent text uses pressed powders: `#4A6878` small (5.6:1) and `#6E8C9E`
large/display (3.3:1).

**Type** — Archivo Variable: wide (`font-stretch` 116–122%) heavy caps for display, normal
width for body; IBM Plex Mono for the label layer (nav, kickers, data, captions). Physics
notation (ħω, α, β, kets) is exempted from the uppercase transform — case is meaning.

**Motion** — `src/lib/fx.jsx` registers GSAP once and exposes a declarative `<Fx>` wrapper:
`data-split` (masked line reveals), `data-fade`, `data-stagger`, `data-draw` (scroll-scrubbed
SVG draw-ins), `data-count` (stat counters), `data-cells` (mosaic). All tweens run inside
`gsap.matchMedia('(prefers-reduced-motion: no-preference)')` — under reduced motion the page
renders complete and static. The hero pins and scrubs on desktop only; scrolling feeds
energy into the particle cloud, which relaxes back to the ground state on release.

**The hero scene** (`src/three/GroundStateScene.jsx`) is physically honest: a wireframe
harmonic well V(r) = ½kr², a particle ensemble relaxing into the gaussian ground-state
density |ψ₀|², a powder ring marking E₀ = ½ħω at the classical turning radius — and
zero-point breathing that never stops (Δx·Δp ≥ ħ/2). Deterministic seed, DPR clamped at
1.75, render loop suspended when the hero leaves the viewport, static settled frame under
reduced motion, and a quiet error boundary if WebGL is unavailable.

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Opens at `http://localhost:5173`.

## Build

```bash
npm run build    # outputs to dist/
npm run preview  # serve the production build locally
```

The three.js scene is split into its own chunk and loaded after first paint; initial JS is
~138 kB gzip.

## Routes

- `/` — the landing page
- `/apply` — membership application
- `/#signal` — The Signal free-newsletter capture

## Form intake (environment variables)

Both forms submit JSON via `src/lib/submit.js` to endpoints injected at build time:

| Variable | Form | Payload |
| --- | --- | --- |
| `VITE_APPLY_ENDPOINT` | `/apply` application | `{ form: "apply", name, email, company, role, applicantType, stage, modality, want }` |
| `VITE_SIGNAL_ENDPOINT` | The Signal subscribe | `{ form: "signal", email }` |

Set them in the Amplify console (App settings → Environment variables) or in a local `.env`
file; Vite inlines them at build. **When an endpoint is unset, the forms render an honest
preview state** — nothing is transmitted or stored, and the UI says so. Self-identified
pre-funded applicants are routed to The Signal instead of the application submit, per the
strategy's funnel rule.

Endpoints must be `https://` (the client refuses anything else) and, since they accept
unauthenticated public POSTs, the receiving side must re-validate shape and length, enforce a
body-size limit, and rate-limit per IP — client-side validation and `maxLength` are courtesy
caps only. Add a honeypot/turnstile before real launch (newsletter endpoints attract
subscription-bombing bots), and fill in the Content-Security-Policy template in
`customHttp.yml` once the endpoint origins are known.

## Deploying to AWS Amplify Hosting (GitHub CI/CD)

The repo includes the two files Amplify reads:

- **`amplify.yml`** — build spec: `npm ci`, `npm run build`, artifacts from `dist/`,
  `node_modules` cached, Node pinned to 22 via `nvm use`.
- **`customHttp.yml`** — security headers (HSTS, X-Frame-Options, nosniff, Referrer-Policy,
  Permissions-Policy).

Setup:

1. In the Amplify console, **Create new app → GitHub** and select
   `AltivumInc-Admin/tqc`, branch `main`. Amplify detects Vite and uses the committed
   `amplify.yml`.
2. **SPA routing**: Amplify auto-creates a 200 rewrite for detected SPAs. The exact rule is
   versioned at `infra/amplify-rewrites.json` — paste it under **Hosting → Rewrites and
   redirects** if deep links such as `/apply` ever 404.
3. After the first deploy, verify deep-link routing:
   `./scripts/verify-deploy.sh https://<branch>.<app-id>.amplifyapp.com`
4. Every push to `main` triggers a build and deploy.

## Project structure

```
src/
  styles/        tokens.css (palette/type), base.css (reset/primitives), components.css
  lib/           fx.jsx (GSAP system), submit.js (form POST helper)
  three/         GroundStateScene.jsx (R3F particle well, lazy chunk)
  components/    Nav, Footer, Mark (brand), Mosaic, HeroScene, figures/
  sections/      Hero (01), Problem (02), Story (03), Proof (04), Inside (05), FinalCta (06)
  pages/         Landing, Apply
```
