# Project Status — The Ground State Society

_Last updated: 2026-06-21. Living snapshot of launch-readiness and open threads.
For the brand north-star see [`.altivum/intent.md`](../.altivum/intent.md); for the
decisions/observations log see [`.altivum/journal.md`](../.altivum/journal.md)._

> This file is hand-maintained. It is **not** auto-generated — update it when the
> state below actually changes (don't let it drift).

## Launch readiness — the site is in PRE-LAUNCH / test mode

| Surface | State | Detail |
|---|---|---|
| **Payments (Stripe)** | 🟡 TEST mode | Amplify env uses `pk_test_…`, a `buy.stripe.com/test_…` link, and test price IDs. No real charges. |
| **Apply form (`/apply`)** | 🟡 Preview | `VITE_APPLY_ENDPOINT` is **unset** → the form renders/validates but does **not** submit or store (see `src/pages/Apply.jsx`). Intentional until intake opens (intent.md: "intake opens at launch"). |
| **The Signal (`/#signal`)** | 🟢 Wired | `VITE_SIGNAL_ENDPOINT = https://api.groundstatesociety.com/subscribe`; `api.` CNAME → us-east-2 execute-api resolves. **Not** independently e2e-verified — see Quantum email gate below. |
| **Checkout** | 🟢 Wired | `VITE_CHECKOUT_ENDPOINT` set (us-east-2). |

**Takeaway for a fresh session / new contributor:** do not assume payments or
applications are live. The free Signal tier is the only active conversion path.

## Hosting & deploy

- **AWS Amplify Hosting.** App `d2c0upa00yly4w`, account `659220242594`
  (CLI profile `ground-state`), region **us-east-1**. The `server: AmazonS3` +
  CloudFront fingerprint is normal Amplify — it is not a bare S3 site.
- **Deploy = push to GitHub `main`** → Amplify auto-builds via `amplify.yml`
  (`npm ci`, `npm test` preBuild gate, `npm run build`, artifacts from `dist/`).
  A local `npm run build` or re-releasing an old commit does nothing on its own.
- **SPA rewrites are NOT in the repo build** — they live in the Amplify app config
  (console **Hosting → Rewrites and redirects**, or `aws amplify update-app
  --custom-rules`). Source-of-truth = [`infra/amplify-rewrites.json`](../infra/amplify-rewrites.json);
  it must be **applied**, it is not auto-pulled from the repo.
- **Cache caveat:** Amplify's CloudFront caches with `s-maxage=31536000` (1 yr) and
  ignores query strings in the cache key. After a rewrite-rule change, a **redeploy**
  (`aws amplify start-job --job-type RELEASE`) is what invalidates the edge cache.
- Post-deploy check: `./scripts/verify-deploy.sh https://groundstatesociety.com [checkout-api]`.

## SEO / AEO (shipped 2026-06-21, live + verified)

- JSON-LD `@graph` (Organization + founder Person + WebSite + OfferCatalog tiers),
  prerendered `/story`, completed Twitter card + AI-aware robots meta, footer
  operator byline, `public/sitemap.xml`, `robots.txt` `Sitemap:` directive.
- Rewrite rules applied: `/story → /story.html` and `xml` static passthrough.
- **Open action (owner):** submit `https://groundstatesociety.com/sitemap.xml` in
  **Google Search Console** (domain verified) and **Bing Webmaster Tools** (Bing's
  index feeds ChatGPT Search citations).
- Strongest remaining AEO lever is off-repo: earned brand mentions / category presence.

## Quantum email gate (the Signal-tier deliverable)

- Backend (`backend/subscribe/`) is **merged to `main`** (PR #1, `a18aa59`).
  Endpoint wired and appears deployed.
- **Pending:** (1) confirm **SES production access** (us-east-2, Transactional — the
  long pole; still sandbox until granted), (2) exercise the real
  signup → email → token path end-to-end, (3) **Plan 2** — the `quantum-computing`
  module side (`/learn` content API + gated notebooks + no-leak CI test).
- Design: [`docs/superpowers/specs/2026-06-17-quantum-module-email-gate-design.md`](superpowers/specs/2026-06-17-quantum-module-email-gate-design.md);
  Plan 1: [`docs/superpowers/plans/2026-06-17-email-capture-verify-backend.md`](superpowers/plans/2026-06-17-email-capture-verify-backend.md).

## Housekeeping

- Stale remote branches (squash-merged into `main`, safe to delete):
  `chore/design-sync-inputs`, `feat/quantum-email-gate`.
- DNS lives in the 659 account (Route 53 zone `Z00828413P9V0JNO3MQGW`); the 205→659
  migration is in progress (backends/SES still moving).

## Source-of-truth pointers

- Brand / north-star: `.altivum/intent.md`
- Decisions & observations journal: `.altivum/journal.md`
- Copy, claims, prices: `quantum_round_premium_strategy.pdf`
- Deploy & env setup: `README.md`
