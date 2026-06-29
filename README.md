# The Ground State Society — Landing Page

The landing page for **The Ground State Society**, the private, members-only network for
quantum founders ($300/month, vetted by application — funding stage is not the bar). Built
with React + Vite. Copy is sourced from `quantum_round_premium_strategy.pdf` (claims whose
deliverability is phased follow the PDF's §9 launch-vs-earned ramp, not the §B benefit list —
see `PRODUCT.md`); the original
section structure followed the page blueprint in `SPA.jpg`, with The Story since moved to
its own `/story` page (landing sections 01–05: Hero · Problem · Proof · Inside · CTA).

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
renders complete and static. The hero does not pin or scrub; scrolling feeds energy into
the particle cloud, which relaxes back to the ground state on release.

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

The three.js scene is code-split into its own chunk by a lazy `import()` (Vite/Rollup splits
it automatically — there is no `manualChunks` rule) and loaded after first paint; initial JS
is ~144 kB gzip.

## Routes

- `/` — the landing page
- `/story` — the founder / origin narrative (prerendered for SEO/AEO)
- `/apply` — membership application (prerendered; `index, follow`)
- `/#signal` — The Signal free-newsletter capture
- `/activate` — post-acceptance membership activation (plan choice → Stripe Checkout).
  Deliberately unlinked from the page and nav: the URL travels only in acceptance emails,
  per the intent boundary that cold visitors are never pushed to the $300 ask.
- `/welcome` — Stripe's `success_url`; verifies the session against the backend before
  claiming the membership is active.
- `/confirm` — The Signal double-opt-in confirmation landing; the magic link points here
  (`noindex`, and `Disallow`ed in robots.txt).

## Form intake (environment variables)

Both forms submit JSON via `src/lib/submit.js` to endpoints injected at build time:

| Variable | Form | Payload |
| --- | --- | --- |
| `VITE_APPLY_ENDPOINT` | `/apply` application | `{ form: "apply", name, email, company, role, applicantType, stage, modality, want }` |
| `VITE_SIGNAL_ENDPOINT` | The Signal subscribe | `{ form: "signal", email, source: "signal", website }` |

`VITE_SIGNAL_ENDPOINT` points at the `gss-subscribe` stack's `ApiUrl` output + `/subscribe`
(the deployed value is `https://api.groundstatesociety.com/subscribe`). Subscribers land on a unified, source-tagged
list; `source: "signal"` identifies Signal signups. The double-opt-in flow sends a
confirmation email — the subscriber's free access (the quantum module deliverable of the
free Signal tier) opens only after they click the confirmation link.

The `website` field is a honeypot: it is never shown or reachable by real users (offscreen,
`aria-hidden`, `tabIndex={-1}`), so any non-empty value reliably marks a bot submission and
the backend rejects it silently.

Set them in the Amplify console (App settings → Environment variables) or in a local `.env`
file; Vite inlines them at build. **When an endpoint is unset, the forms render an honest
preview state** — nothing is transmitted or stored, and the UI says so. Membership is open
to operating quantum founders at any funding stage; vetting happens in review, not in the
form.

Endpoints must be `https://` (the client refuses anything else) and, since they accept
unauthenticated public POSTs, the receiving side must re-validate shape and length, enforce a
body-size limit, and rate-limit per IP — client-side validation and `maxLength` are courtesy
caps only. Fill in the Content-Security-Policy template in `customHttp.yml` once the
endpoint origins are known.

## Stripe Checkout backend (`backend/checkout/`)

Membership payment runs through Stripe Checkout sessions created by a small dependency-free
Lambda (SAM stack `gss-stripe-checkout`, us-east-2) behind an API Gateway HTTP API:

| Route | Purpose |
| --- | --- |
| `POST /checkout` | `{ plan: "monthly" \| "annual" }` → creates a subscription Checkout session, returns `{ url }` |
| `GET /session?session_id=cs_...` | Safe status subset (`status`, `payment_status`, `customer_email`, `plan`) for `/welcome` |
| `POST /webhook` | Stripe events, HMAC-verified (fail-closed until the signing secret is configured) |

CORS is handled by the HTTP API (`CorsConfiguration` in `template.yaml`), not the Lambda.
The Stripe catalog lives in the sandbox account: product **The Round — Membership** with
prices `round_monthly` ($300/mo, founding rate) and `round_annual` ($3,600/yr), plus the
`REFER-A-FOUNDER` coupon (100% off one invoice — apply only to monthly subscriptions).

Local development:

```bash
node --env-file=.env.local backend/checkout/local.mjs   # handler on :8787
# .env.local: VITE_CHECKOUT_ENDPOINT=http://localhost:8787
```

Tests (`backend/checkout/test/handler.test.mjs` — routing, plan guard, signature
verification, response allowlist; zero dependencies, Stripe is mocked):

```bash
npm test   # also runs in Amplify preBuild — a red suite blocks the deploy
```

Deploy. The Stripe keys live in a Secrets Manager secret (a JSON object with
`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`); the stack takes only its ARN, so the keys
are never a Lambda env var (readable via `lambda:GetFunctionConfiguration`) or in
`samconfig.toml`. The handler fetches and caches them at cold start:

```bash
# one-time: create the secret holding the Stripe keys
aws secretsmanager create-secret --name gss/checkout --region us-east-2 --profile ground-state \
  --secret-string '{"STRIPE_SECRET_KEY":"sk_...","STRIPE_WEBHOOK_SECRET":"whsec_..."}'

cd backend/checkout
sam deploy --parameter-overrides \
  "CheckoutSecretsArn=$CHECKOUT_SECRETS_ARN PriceMonthly=price_... PriceAnnual=price_..." \
  "AlarmEmail=you@example.com"
```

`AlarmEmail` wires two CloudWatch alarms to email: `CheckoutFailureAlarm` (a metric
filter on the structured `stripe_error`/`unhandled` logs — the handler catches errors
and returns 502, so the plain Lambda Errors metric alone would stay silent) and
`CheckoutCrashAlarm` (invocation errors: crashes/timeouts). Confirm the SNS
subscription from the email AWS sends after the first deploy. Leaving the parameter
empty disables the alarms. Also enable Stripe Dashboard email notifications for
failed webhook deliveries — an independent second net.

Then set `VITE_CHECKOUT_ENDPOINT` to the stack's `ApiUrl` output (Amplify console for
production). When it is unset, `/activate` renders an honest preview state. Done for live
readiness: secrets are fetched from Secrets Manager at cold start, the deployed CORS
allowlist is production-only (no `localhost`), and the webhook de-duplicates replayed events
via a DynamoDB conditional write. Still open before live keys: per-IP / per-email rate
limiting (only stage-level throttling exists today), and pointing the secret's
`STRIPE_WEBHOOK_SECRET` at the live-mode signing secret.

## Deploying to AWS Amplify Hosting (GitHub CI/CD)

The repo includes the two files Amplify reads:

- **`amplify.yml`** — build spec: `npm ci`, `npm run build`, artifacts from `dist/`,
  `node_modules` cached, Node pinned to 22 via `nvm use`.
- **`customHttp.yml`** — security headers (HSTS, X-Frame-Options, nosniff, Referrer-Policy,
  Permissions-Policy).

Setup:

1. In the Amplify console, **Create new app → GitHub** and select
   `AltivumInc-Admin/ground-state`, branch `main`. Amplify detects Vite and uses the committed
   `amplify.yml`.
2. **SPA routing**: Amplify auto-creates a 200 rewrite for detected SPAs. The exact rule is
   versioned at `infra/amplify-rewrites.json` — paste it under **Hosting → Rewrites and
   redirects** if deep links such as `/apply` ever 404.
3. After every deploy that touches the frontend or the checkout stack, verify
   deep-link routing AND that the shipped bundle points at a live API:
   `./scripts/verify-deploy.sh https://groundstatesociety.com https://<api-id>.execute-api.us-east-2.amazonaws.com`
   (the second argument is the stack's `ApiUrl` output; omitting it skips the API checks)
4. Every push to `main` triggers a build and deploy — preBuild runs `npm test`,
   so a red backend suite stops the publish.

## Project structure

```
src/
  styles/        tokens.css (palette/type), base.css (reset/primitives), components.css
  lib/           fx.jsx (GSAP system), submit.js (form POST/JSON helpers)
  three/         GroundStateScene.jsx (R3F particle well, lazy chunk)
  components/    Nav, Footer, Mark (brand), Mosaic, HeroScene, figures/
  sections/      Hero (01), Problem (02), Proof (03), Inside (04), FinalCta (05), Story (/story)
  pages/         Landing, Story, Apply, Activate, Welcome, Confirm
backend/
  checkout/      SAM stack: Stripe Checkout sessions + webhook (template.yaml, src/handler.mjs)
```
