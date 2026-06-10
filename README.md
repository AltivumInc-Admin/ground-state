# The Quantum Collective — Landing Page

The landing page for **The Quantum Collective**, the private, members-only network for funded
quantum founders ($300/month). Built with React + Vite. Copy is sourced from
`quantum_round_premium_strategy.pdf`; the section structure follows the page blueprint in
`SPA.jpg` (Hero · Problem · Story · Proof · Features · CTA — displayed on the page as
sections 01–06).

## Stack

- [Vite](https://vite.dev/) + [React](https://react.dev/) + [React Router](https://reactrouter.com/)
- Self-hosted fonts via Fontsource (Fraunces, Hanken Grotesk, IBM Plex Mono) — no third-party requests
- No CSS framework — hand-written design system in `src/styles/`

### Palettes (strict 60/20/10/10, comparable via the nav toggle)

Three candidate palettes share the same 60/20/10/10 roles. The pill toggle in the nav
switches between them (persisted in `localStorage`, applied pre-paint by an inline script in
`index.html`, implemented as a `data-theme` attribute override of the design tokens).

**Palette 01 — default**

| Token | Hex | Share | Use |
| --- | --- | --- | --- |
| `--parchment` | `#E7E1D4` | 60% | Base canvas / backgrounds |
| `--chestnut` | `#B0664E` | 20% | CTAs, highlights, active states |
| `--mushroom` | `#A4988C` | 10% | Borders, dividers, section bands |
| `--obsidian` | `#05040B` | 10% | Text, headings, footer |

**Palette B — `data-theme="olive"`**

| Role | Hex | Share |
| --- | --- | --- |
| Base (Sage) | `#E3E4DC` | 60% |
| Accent (Silver) | `#C4C4C6` | 20% |
| Secondary (Olive) | `#827D65` | 10% |
| Dark (Darkmoss) | `#494637` | 10% |

**Palette C — `data-theme="powder"`**

| Role | Hex | Share |
| --- | --- | --- |
| Base (Ghost) | `#F7F7FF` | 60% |
| Accent (Powder) | `#C1D8E2` | 20% |
| Secondary (Sand) | `#B7A781` | 10% |
| Dark (Umber) | `#432D16` | 10% |

Palette C's contrast spine: body Umber-on-Ghost 12.1:1; button labels Umber-on-Powder 8.7:1;
accent text uses pressed powders (`#4A6878` small ≈5.6:1, `#6E8C9E` large ≈3.3:1); Sand
serves footer muted text directly (5.5:1 on Umber).

Defined as CSS custom properties in `src/styles/tokens.css`. Contrast notes (palette 01):
body text is Obsidian on Parchment (≈16:1); buttons use Obsidian labels on Chestnut fills
(≈4.7:1, AA); Mushroom is decorative-only on light ground and is used for muted text only on
the Obsidian footer (≈7:1). Small chestnut-toned labels use `--chestnut-ink` (#8B5340), a
pressed shade of Chestnut that passes AA (≈4.7:1) on Parchment — pure Chestnut text appears
only at large sizes. Palette 02 mirrors the same system: its silver accent is far too light
for text on the sage base (1.36:1), so accent text uses darkened silvers (`#5C5C60` small
≈5.2:1, `#7E7E81` large ≈3.2:1), text alphas rise to offset the softer dark tone
(body ≈7.4:1, button labels ≈5.5:1), and footer muted text switches to a sage alpha (≈4.9:1).

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
  components/    Nav, Footer, Mark (brand), Interference (hero figure), Reveal (scroll reveal)
  sections/      Hero (03), Problem (04), Story (05), Proof (06), Inside (07), FinalCta (08)
  pages/         Landing, Apply
```
