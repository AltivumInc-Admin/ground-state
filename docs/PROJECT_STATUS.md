# Project Status — The Ground State Society

_Last updated: 2026-06-25. Living snapshot of launch-readiness and open threads.
For the brand north-star see [`.altivum/intent.md`](../.altivum/intent.md); for the
decisions/observations log see [`.altivum/journal.md`](../.altivum/journal.md)._

> This file is hand-maintained. It is **not** auto-generated — update it when the
> state below actually changes (don't let it drift).

## Launch readiness — the site is in PRE-LAUNCH / test mode

| Surface | State | Detail |
|---|---|---|
| **Payments (Stripe)** | 🟡 TEST mode | Amplify env uses `pk_test_…`, a `buy.stripe.com/test_…` link, and test price IDs. No real charges. |
| **Apply form (`/apply`)** | 🟡 Preview | Page is now **prerendered + indexable** (own `<h1>`/meta, in `sitemap.xml`, `/apply → /apply.html` rewrite applied). Submission is still preview: `VITE_APPLY_ENDPOINT` is **unset** → renders/validates but does **not** submit or store (see `src/pages/Apply.jsx`). Intentional until intake opens (intent.md: "intake opens at launch"). **At intake-open, also add the apply origin to CSP `connect-src` — see Backend security below.** |
| **The Signal (`/#signal`)** | 🟢 **LIVE** | Double opt-in is **inbox-verified end-to-end** (2026-06-25): `/subscribe` → Postmark → inbox → magic link → `/verify` → confirmed. `VITE_SIGNAL_ENDPOINT = https://api.groundstatesociety.com/subscribe`. See **Email — The Signal gate** below. |
| **Checkout** | 🟢 Wired | `VITE_CHECKOUT_ENDPOINT` set (us-east-2); secrets now in Secrets Manager — see Backend security below. |

**Takeaway for a fresh session / new contributor:** do not assume payments or
applications are live. The free Signal tier is the only active conversion path.

## Hosting & deploy

- **AWS Amplify Hosting.** App `d2c0upa00yly4w`, account `659220242594`
  (CLI profile `ground-state`), region **us-east-1**. The `server: AmazonS3` +
  CloudFront fingerprint is normal Amplify — it is not a bare S3 site.
- **Deploy = push to GitHub `main`** → Amplify auto-builds via `amplify.yml`
  (`npm ci`, then the preBuild gate `npm test` + **`npm run test:fe`** + **`npm run lint`**,
  then `npm run build`, artifacts from `dist/`). A red suite OR lint error blocks the
  publish. A local `npm run build` or re-releasing an old commit does nothing on its own.
  PRs also run the same gate via `.github/workflows/ci.yml`.
- **SPA rewrites are NOT in the repo build** — they live in the Amplify app config
  (console **Hosting → Rewrites and redirects**, or `aws amplify update-app
  --custom-rules`). Source-of-truth = [`infra/amplify-rewrites.json`](../infra/amplify-rewrites.json);
  it must be **applied**, it is not auto-pulled from the repo. **Live rules:**
  `/story → /story.html`, `/apply → /apply.html`, SPA catch-all → `/index.html`
  (the catch-all regex excludes static extensions incl. `xml`, so the sitemap serves statically).
- **Cache caveat:** Amplify's CloudFront caches with `s-maxage=31536000` (1 yr) and
  ignores query strings in the cache key. After a rewrite-rule or `customHttp.yml` change,
  a **redeploy** (`aws amplify start-job --job-type RELEASE`) is what invalidates the edge cache.
- Post-deploy check: `./scripts/verify-deploy.sh https://groundstatesociety.com [checkout-api]`.

## Backend security & CSP (cutover 2026-06-25, deployed + verified live)

- **Secrets live in AWS Secrets Manager, not Lambda env vars.** `gss/checkout`
  (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) and `gss/subscribe`
  (`SESSION_SECRET`, `TOKEN_PEPPER`, `POSTMARK_TOKEN`, `POSTMARK_WEBHOOK_SECRET`) are
  fetched at cold start (env-preferring, so tests/local stay offline). **Redeploys pass `CheckoutSecretsArn` /
  `SubscribeSecretsArn`** — the old per-secret CFN params are gone from the templates.
  Migrated from the prior env values (not regenerated). Verified: `lambda
  get-function-configuration` shows no secret env vars.
- **Checkout CORS is production-only** (`localhost:5173` dropped). **Stripe webhook is
  idempotent** — DynamoDB `ProcessedEventsTable`, conditional write keyed by `evt.id`
  (7-day TTL); replays return `{received,duplicate}` before any side effect.
- **Content-Security-Policy is ENFORCING** (`customHttp.yml`), flipped from Report-Only
  after a clean live soak (zero violations across `/`, `/story`, `/activate`). Policy:
  self-only `default/script/font/img-src`, `style-src 'unsafe-inline'` (GSAP/R3F inline
  styles), `connect-src` = self + `api.groundstatesociety.com` + the checkout
  `*.execute-api.us-east-2.amazonaws.com`.
  - ⚠️ **When `VITE_APPLY_ENDPOINT` is set at intake-open, ADD its origin to
    `connect-src` in `customHttp.yml` and redeploy** — otherwise the enforcing CSP
    silently blocks `/apply` form submissions.
- **Still open before live keys:** per-IP / per-email rate limiting (only stage-level
  throttling today), and pointing `STRIPE_WEBHOOK_SECRET` at the live-mode signing secret.

## SEO / AEO (shipped 2026-06-21; `/apply` added 2026-06-25)

- JSON-LD `@graph` (Organization + founder Person + WebSite + OfferCatalog tiers),
  prerendered `/story` **and `/apply`**, completed Twitter card + AI-aware robots meta,
  footer operator byline, `public/sitemap.xml` (`/`, `/story`, `/apply`), `robots.txt`
  `Sitemap:` directive. `/story` carries a single `<h1>`.
- Rewrite rules applied: `/story → /story.html`, `/apply → /apply.html`, and `xml`/static
  passthrough (via the catch-all regex's extension exclusions).
- **Open action (owner):** submit `https://groundstatesociety.com/sitemap.xml` in
  **Google Search Console** (domain verified) and **Bing Webmaster Tools** (Bing's
  index feeds ChatGPT Search citations).
- Strongest remaining AEO lever is off-repo: earned brand mentions / category presence.

## Email — The Signal gate (LIVE via Postmark, inbox-verified 2026-06-25)

- Backend `backend/subscribe/` (PR #1) sends the double opt-in confirmation via
  **Postmark** (HTTPS API, no SDK) on the `outbound` transactional Message Stream.
  Account approved + **inbox-verified end-to-end** 2026-06-25 (Gmail/Workspace): the
  rebuilt email lands in the inbox and the magic link round-trips through `/verify`.
- **Provider = Postmark, NOT SES.** We migrated off SES because production access was
  DENIED — then it was later **GRANTED** (case `178181335200610` now shows GRANTED,
  50k/day, us-east-2). **SES is kept as a documented fallback** (identity + DKIM + custom
  MAIL FROM still in place). Postmark chosen for transactional inbox placement + Message
  Streams isolation (transactional vs. the future newsletter on a separate stream).
- **Sender setup:** `groundstatesociety.com` (production From `no-reply@groundstatesociety.com`)
  and `altivum.ai` are verified in Postmark — DKIM + Return-Path CNAMEs live in Route 53
  `Z00828413P9V0JNO3MQGW`. `POSTMARK_TOKEN` (Postmark Server API token) lives in the
  `gss/subscribe` Secrets Manager secret, hydrated at cold start.
- **Deliverability lesson:** the first send hit spam — a cold sending domain **plus**
  Postmark's default link/open tracking (it rewrites the magic link through a redirect
  domain) **plus** thin content. Fixed in `email.mjs`: `TrackLinks:'None'` + `TrackOpens:false`
  (clean un-proxied link, no pixel), a real From display name, and a rebuilt legitimate
  template. **Still recommended:** warm the domain; spot-check Outlook placement. (DKIM
  stays **1024-bit** — Postmark issues 1024-bit keys only, there is no 2048 option — which
  still meets Gmail/Yahoo's ≥1024-bit requirement; DKIM/Return-Path/DMARC are all verified,
  so there is no key upgrade to make.)
- **Suppression — `POST /postmark-webhook` is DEPLOYED + live-verified (2026-06-25).**
  Same subscribe Lambda/stack; HTTP Basic-auth (`postmark` : `POSTMARK_WEBHOOK_SECRET`
  in the `gss/subscribe` secret; fails closed if unset). On a Postmark spam complaint or
  hard bounce it writes a permanent `suppressed` tombstone (no TTL) keyed `EMAIL#<addr>`,
  and `createPending` now refuses to resurrect a suppressed address — so we never re-email
  a complainer. Verified against the live endpoint: no/wrong auth → 401, complaint → 200 +
  a real `status=suppressed` row. **Registered in Postmark** (2026-06-25) on the `outbound`
  stream's Webhooks — URL `https://api.groundstatesociety.com/postmark-webhook`, Bounce +
  SpamComplaint enabled, Basic auth `postmark` / `POSTMARK_WEBHOOK_SECRET` (message content
  off); Postmark's "Send test" returned `200`. Fully active.
- **Still pending:** **Plan 2** — the `quantum-computing` module side (`/learn` content API +
  gated notebooks + no-leak CI test).
- Design: [`docs/superpowers/specs/2026-06-17-quantum-module-email-gate-design.md`](superpowers/specs/2026-06-17-quantum-module-email-gate-design.md);
  Plan 1: [`docs/superpowers/plans/2026-06-17-email-capture-verify-backend.md`](superpowers/plans/2026-06-17-email-capture-verify-backend.md).

## Deferred eval findings (2026-06-24 codebase eval; not yet addressed)

Lower-severity items surfaced but out of scope of the top-3 recs that shipped:
`--sand` is a non-re-resolving token at ~2.2:1 on the light ground (a latent WCAG AA
trap if a sand-text class lands on a light section); imperatively-built Three.js
geometries/CanvasTexture are not disposed (GPU leak on `BlochFigure` pause/resume);
`verify()` consumes the single-use token even when `confirm()` fails; `/welcome` +
`/confirm` are JS-only `noindex` (robots-disallowed, low risk); no `site.webmanifest`,
no `.nvmrc`/`engines` pin, no enforced bundle-size budget.

## Housekeeping

- Stale remote branches (squash-merged into `main`, safe to delete):
  `chore/design-sync-inputs`, `feat/quantum-email-gate`.
- DNS lives in the 659 account (Route 53 zone `Z00828413P9V0JNO3MQGW`); the 205→659
  migration is in progress (backends/SES still moving).

## Source-of-truth pointers

- Brand / north-star: `.altivum/intent.md`
- Decisions & observations journal: `.altivum/journal.md`
- Copy, claims, prices: `quantum_round_premium_strategy.pdf` (phased claims follow its §9
  launch-vs-earned ramp, not the §B benefit list — framing rule in `PRODUCT.md`)
- Deploy & env setup: `README.md`
