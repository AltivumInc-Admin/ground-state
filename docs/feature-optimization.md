# Feature Optimization

> This file tracks ways to REFINE features that already exist in this project.
> It is NOT a roadmap of new features to add — nothing here introduces new
> functionality. Every item makes an existing feature cleaner, faster, safer,
> more accessible, or otherwise better.
>
> Maintained by the `/optimize-features` command. Last full inventory: 2026-06-27

## Feature Inventory

### A. Marketing & content pages

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 1 | Landing page scroll narrative | The homepage: a five-section scroll story (01 Hero · 02 Problem · 03 Proof · 04 Inside · 05 Join) with stat counters, responsive comparison/matrix tables, ROI math, and the wave–particle figure divider. | `src/pages/Landing.jsx`, `src/sections/{Hero,Problem,Proof,Inside,FinalCta}.jsx` | 2026-06-27 |
| 2 | The Story page | Founder/origin E-E-A-T narrative at `/story`, prerendered to static HTML with its own head/canonical for crawlers. | `src/pages/Story.jsx`, `src/sections/Story.jsx` | 2026-06-27 |
| 3 | The Signal web archive | Public newsletter archive: issue index (`/signal`) and per-issue reader (`/signal/:slug`) rendering Sanity Portable Text, each prerendered with article meta. | `src/pages/Signal.jsx`, `src/pages/SignalIssue.jsx`, `src/components/IssueBody.jsx`, `src/lib/issues.js` | 2026-06-27 |

### B. Conversion & membership flows

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 4 | Membership application (`/apply`) | Multi-field gated application (name/email/company/role/type/stage/modality/want) with client validation, accessible error+success states, and an honest no-endpoint preview. | `src/pages/Apply.jsx`, `src/lib/submit.js` | 2026-06-27 |
| 5 | The Signal signup + double opt-in | Free-tier email capture (landing CTA, archive, issue pages) with honeypot + concurrent-submit guard, and the magic-link confirmation landing (`/confirm`). | `src/components/SignalSubscribe.jsx`, `src/pages/Confirm.jsx`, `src/lib/submit.js` | 2026-06-27 |
| 6 | Membership activation & Stripe Checkout flow | `/activate` plan choice → Stripe Checkout redirect (open-redirect guarded), `/welcome` verifies the session against the backend before claiming membership active; bfcache-safe. | `src/pages/Activate.jsx`, `src/pages/Welcome.jsx` | 2026-06-27 |

### C. Immersive & visual features

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 7 | Hero ground-state 3D scene | R3F harmonic-well particle simulation (relaxation to gaussian |ψ₀|², zero-point breathing, scroll-injected energy); lazy chunk, DPR clamp, in-view frameloop gating, WebGL error boundary, reduced-motion static frame. | `src/three/GroundStateScene.jsx`, `src/components/HeroScene.jsx` | 2026-06-27 |
| 8 | Physics SVG figures | Scroll-drawn line-art diagrams (wave–particle, energy levels, Bloch sphere) used as section dividers/illustrations, with captions and reduced-motion fallbacks. | `src/components/figures/*.jsx`, `src/three/BlochScene.jsx` | 2026-06-27 |

### D. Backend services

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 9 | Stripe Checkout Lambda | Dependency-free Lambda (HTTP API): `POST /checkout` (plan→session), `GET /session` (safe status subset), `POST /webhook` (HMAC-verified, DynamoDB-idempotent); secrets from Secrets Manager, CloudWatch alarms. | `backend/checkout/src/handler.mjs`, `backend/checkout/template.yaml` | 2026-06-27 |
| 10 | Subscribe / verify Lambda + suppression | Double opt-in `POST /subscribe` (honeypot, source allowlist, hashed token, consent IP) + `POST /verify` (single-use token → session JWT) + `POST /postmark-webhook` (Basic-auth bounce/complaint/unsubscribe suppression). | `backend/subscribe/src/{handler,crypto,store,email}.mjs`, `backend/subscribe/template.yaml` | 2026-06-27 |
| 11 | The Signal email distribution CLI | Operator `send-issue` CLI: fetch a published issue from Sanity, render HTML+text email, list confirmed recipients from DynamoDB, batch-send via Postmark Broadcast; dry-run by default, refuses to send without the unsubscribe placeholder. | `backend/broadcast/send-issue.mjs`, `backend/broadcast/src/*.mjs` | 2026-06-27 |

### E. Content management

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 12 | Sanity Studio for The Signal | Issue authoring CMS: `issue` document (slug/status/publishedAt/excerpt/body/seo), block content + image objects, custom desk structure, Vision tool. | `studio/sanity.config.ts`, `studio/schemaTypes/**`, `studio/src/structure.ts` | 2026-06-27 |
| 13 | Build-time issue fetch | First build step: GROQ-query published issues from Sanity into a static JSON module the bundle and prerender both read; writes an empty list (build still succeeds) when unconfigured. | `scripts/fetch-issues.mjs`, `src/content/issues.generated.json` | 2026-06-27 |

### F. Cross-cutting frontend systems

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 14 | GSAP scroll choreography system | Declarative `<Fx>` wrapper translating `data-*` annotations (split/fade/stagger/draw/cells/count/tilt) into ScrollTrigger tweens, all gated inside `matchMedia(prefers-reduced-motion: no-preference)`. | `src/lib/fx.jsx` | 2026-06-27 |
| 15 | Custom cursor reticle | Measurement-reticle cursor companion that frames interactive elements on hover and tracks scroll; fine-pointer-only, disabled under reduced motion. | `src/components/Cursor.jsx` | 2026-06-27 |
| 16 | Motion pause + reduced-motion system | WCAG 2.2.2 pause/resume control for auto-animating scenes, backed by a shared motion-paused store that also reuses the reduced-motion render path. | `src/components/MotionToggle.jsx`, `src/lib/motion.js` | 2026-06-27 |
| 17 | Navigation | Floating header with section scrollspy, scroll-progress hairline, over-dark→light treatment switch, anchor links, and mobile menu toggle. | `src/components/Nav.jsx`, `src/components/Mark.jsx` | 2026-06-27 |
| 18 | Footer | Site footer with operator byline (E-E-A-T) and supporting links/legal copy. | `src/components/Footer.jsx` | 2026-06-27 |
| 19 | Per-route SEO/meta head | SPA hook syncing title/description/canonical/robots and OG/Twitter tags per route (with homepage-reset semantics) so each route presents correctly to AT, search, and unfurls. | `src/lib/usePageMeta.js` | 2026-06-27 |
| 20 | Design system / tokens | Hand-written design system: 60/20/10/10 palette + semantic tokens, `.ground-dark` re-resolution, Archivo/IBM Plex Mono type scale, primitives & components. | `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/components.css` | 2026-06-27 |

### G. SEO, build & ops

| # | Feature | What it does | Where it lives | Last reviewed |
|---|---------|--------------|----------------|---------------|
| 21 | Prerender + SSR pipeline | Renders indexable routes (`/`, `/story`, `/apply`, `/signal`, each issue) to static HTML after the SSR build, with per-route head injection, render-marker guards, and `data-route` hydration gating. | `scripts/prerender.mjs`, `scripts/lib/inject-head.mjs`, `src/entry-static.jsx` | 2026-06-27 |
| 22 | Structured data & social meta | JSON-LD `@graph` (Organization + founder Person + WebSite + OfferCatalog tiers) and full OG/Twitter card set in the static head. | `index.html` | 2026-06-27 |
| 23 | Sitemap & robots | Sitemap regenerated from prerendered routes (static + non-noindex issues) at build; static `robots.txt` with sitemap directive and AI-crawler rules. | `scripts/prerender.mjs` (sitemap block), `public/robots.txt` | 2026-06-27 |
| 24 | Security headers + CSP | Amplify `customHttp.yml`: HSTS, X-Frame-Options, nosniff, Referrer/Permissions policies, and an enforcing Content-Security-Policy scoped to self + the two API origins. | `customHttp.yml` | 2026-06-27 |
| 25 | CI / deploy test gate | preBuild + GitHub Actions gate: `npm test` (backend) + `npm run test:fe` (Vitest) + `npm run lint` must pass before build/publish; Node pinned to 22. | `amplify.yml`, `.github/workflows/ci.yml` | 2026-06-27 |
| 26 | Deploy verification script | Post-deploy curl check: deep links rewrite to the SPA shell, the shipped bundle references a live checkout API, sitemap serves statically. | `scripts/verify-deploy.sh` | 2026-06-27 |

## Optimization Opportunities

> Category G (features 21-26) audited 2026-06-27 via the `/optimize-features`
> verified workflow: 29 feature×lens reviews → 117 raw findings → adversarially
> verified against the real code → deduped to the items below. Impact ratings are
> the post-verification ratings, with a few elevated to High where the issue is a
> live, user-visible break rather than a latent one.

### Execution status — 2026-06-27 (branch `chore/seo-build-ops-hardening`, not yet pushed)

**Shipped on the branch (verified locally — `npm test` 115 ✓, `test:fe` 34 ✓, lint ✓, build ✓):**
- 21: escape CMS head values; fail-loud on any missed head swap; fail-loud on missing
  Sanity creds in a production build; validate issue slug; table-driven injectHead.
- 22: JSON-LD `@graph` validity guard; removed the redundant `ogTitle` ternary.
- 23: XML-escape + slug validation; pure tested `scripts/lib/sitemap.mjs`; sitemap derived
  from `ROUTES` (single source); sitemap write guard; deleted stale `public/sitemap.xml`.
- 24: `img-src https://cdn.sanity.io` + `form-action 'self'`; `check-csp.mjs` connect-src/
  endpoint reconciliation guard (Amplify preBuild).
- 25: orphaned scripts tests wired into the gate; `node --test` zero-match guard;
  CI least-privilege permissions + concurrency + timeout.
- 26: verify-deploy chunk crawl (verified host-in-lazy-chunk against a real build),
  header verification, catch-all probe + `data-route` marker, `--max-time`, stderr,
  network-fail, sitemap probe, tightened cleartext guard, arg-2 scheme validation.

**Deferred (with reason):**
- 24 — narrow `connect-src` to a custom subdomain (`checkout.groundstatesociety.com`):
  needs ACM cert (us-east-2) + API Gateway v2 custom domain + Route 53 + a `check-aws-docs`
  pass + deploy. The `check-csp.mjs` guard already works against the current wildcard.
- 24 — build-time "no inline executable script" scan: not yet implemented.
- 25 — run `npm run build` in `ci.yml`; single-source the Node pin; SHA-pin actions
  (SHAs not verifiable offline).
- 22 — homepage-head single-source snapshot; stale `og:image:alt/type` on issue pages;
  JSON-LD price/tier de-dup (runtime-touching refactors, own PRs).
- 21 — injectHead sequential-pass / per-issue `mkdir` perf; GROQ/SITE de-dup.
- 26 — bats/extracted-helper tests for the bash script.

**Deploy-gated (item 1 / 24):** the `img-src` change is committed but takes effect only after
a push to `main` + an Amplify `RELEASE` job (CloudFront edge cache), then a re-soak of a
`/signal/:slug` page with an inline figure.

### 21. Prerender + SSR pipeline
- [ ] **[Security]** Escape CMS-sourced head values before injecting into static HTML — issue titles/descriptions/og:image flow verbatim into `<title>` and `content="..."` attributes; an ordinary editorial `"` or `&` corrupts the og/twitter/meta cards, and `</title><script>` ships into served HTML (CSP blocks execution but not card corruption / meta-refresh / injected forms). Add an `escapeHtml` helper, escape every interpolated value, and compare the post-swap guard against the escaped title. Impact: High. Effort: Low. (`scripts/lib/inject-head.mjs:21-39`, `scripts/prerender.mjs:79-85,123`) — added 2026-06-27
- [ ] **[Resilience]** Guard every injected head field, not just `<title>` — the post-injection assertion checks only the title, so on any index.html formatting drift the description/canonical/og:image/og:type/robots swaps silently no-op; a `noindex` issue would ship indexable and every issue could inherit the homepage canonical, with a green build. Have `injectHead` report which keys it actually swapped and assert each requested field changed. Impact: High. Effort: Low. (`scripts/prerender.mjs:122-125`, `scripts/lib/inject-head.mjs:32-48`) — added 2026-06-27
- [ ] **[Observability]** Fail loudly when a production build has no Sanity creds or yields zero issues — `fetch-issues` treats a missing `SANITY_PROJECT_ID` as the intended preview path (writes `[]`, exits 0), so a prod build that lost its env var silently delists the entire newsletter archive (sitemap collapses to 4 routes) with a green deploy, indistinguishable from a dev machine. Gate the inert path on an explicit preview/CI flag, or emit a distinct warning + non-zero exit when zero issues are prerendered. Impact: Medium. Effort: Medium. (`scripts/fetch-issues.mjs:58-63`, `scripts/prerender.mjs:78,162`) — added 2026-06-27
- [ ] **[Architecture]** Single source of truth for per-route head metadata — each indexable route's title/description is encoded twice (prerender `ROUTES` vs the page's `usePageMeta()`), and `/story` has already drifted (the prerendered description carries a "Christian Perez…" clause the hydrated hook drops, so non-JS crawlers and JS clients see different descriptions for the same URL). Extract one shared route-metadata module both consume. Impact: Medium. Effort: Medium. (`scripts/prerender.mjs:38`, `src/pages/Story.jsx:9`, `src/lib/usePageMeta.js:40-46`) — added 2026-06-27
- [ ] **[Security]** Validate the issue slug before using it as a filesystem path — the raw CMS slug is interpolated into `signal/${slug}.html` and `writeFile`'d; the `^[a-z0-9-]+$` rule lives only in the Studio (advisory, bypassable via API writes). Re-validate in `normalizeIssues`. Impact: Low. Effort: Low. (`scripts/prerender.mjs:90,128-130`, `scripts/fetch-issues.mjs:38-39`) — added 2026-06-27
- [ ] **[Cleaner]** Collapse `injectHead`'s repeated capture-group replace lambda (9-11 near-identical blocks) into a table-driven loop over `{regex, value}`. Impact: Low. Effort: Low. (`scripts/lib/inject-head.mjs:21-48`) — added 2026-06-27
- [ ] **[Performance]** `injectHead` makes up to 12 sequential full-string `replace` passes (each copies the whole HTML), and the route loop re-`mkdir`s per issue and serializes all file I/O — batch the replaces / hoist the mkdir / parallelize writes. Impact: Low. Effort: Medium. (`scripts/lib/inject-head.mjs:17-50`, `scripts/prerender.mjs:107-131`) — added 2026-06-27
- [ ] **[Architecture]** De-duplicate the published-issue GROQ projection shared between the prerender pipeline and the broadcast backend, and the `SITE` base + route list duplicated across the build script, the client hook, and index.html. Impact: Low. Effort: Medium. (`scripts/fetch-issues.mjs:15-34`, `backend/broadcast/src/issue-email.mjs`) — added 2026-06-27

### 22. Structured data & social meta (JSON-LD @graph)
- [ ] **[Resilience]** Add a build/test guard that extracts the inline `ld+json` block, `JSON.parse`s it, and asserts every `@id` reference resolves to a node — the ~88-line hand-maintained `@graph` with internal cross-refs is never parse-checked, so one trailing comma or dangling `@id` makes Google silently discard all structured data with a green build. Impact: Medium. Effort: Low. (`index.html:29-117`, `scripts/prerender.mjs:100-125`) — added 2026-06-27
- [ ] **[Architecture]** Make index.html the single source of truth for the homepage head — title/OG/description/robots are re-declared as JS constants in `usePageMeta.js` and unconditionally re-written over the static markup on hydration, so any index.html edit not mirrored in the constants visibly degrades the homepage after React boots. Snapshot the server-rendered head once at module load and use that as the reset baseline. Impact: Medium. Effort: Medium. (`src/lib/usePageMeta.js:5-17,56-61`, `index.html:6,12-13,24-25,28`) — added 2026-06-27
- [ ] **[Accessibility]** When `injectHead` swaps `og:image` on issue pages, update its companion `og:image:alt` and `og:image:type` — both still describe the homepage particle PNG, so a Signal issue's social card carries a mismatched alt/MIME for its own image. Impact: Low. Effort: Low. (`scripts/lib/inject-head.mjs:37-44`, `index.html:22,27`) — added 2026-06-27
- [ ] **[Resilience]** An issue with no excerpt/SEO description ships the homepage meta description on its article page (disagreeing with the client fallback), and `usePageMeta` silently no-ops when a meta tag is absent (untested, inconsistent with its self-healing robots branch). Impact: Low. Effort: Low. (`scripts/prerender.mjs:81-82`, `src/lib/usePageMeta.js:19-27`) — added 2026-06-27
- [ ] **[Cleaner]** Remove the redundant `ogTitle` ternary (always equals `fullTitle`) and the unreachable raw-DOM robots branch in `usePageMeta`. Impact: Low. Effort: Low. (`src/lib/usePageMeta.js:56`) — added 2026-06-27
- [ ] **[Architecture]** The JSON-LD `@graph` re-encodes UI facts (prices, tier copy, org description) as a parallel source of truth that can drift from the rendered pages. Impact: Low. Effort: High. (`index.html:78-112`) — added 2026-06-27

### 23. Sitemap & robots
- [ ] **[Security]** XML-escape `<loc>`/`<lastmod>` and validate the CMS slug (`^[a-z0-9-]+$`) before it reaches the sitemap — an `&` or `<` in a slug emits invalid XML that makes crawlers reject the *entire* sitemap (every URL goes dark); the same value also feeds the output file path. Validate in `normalizeIssues` and add a shared escape helper at emit. Impact: Medium. Effort: Low. (`scripts/prerender.mjs:142-157`, `scripts/fetch-issues.mjs:38-39`) — added 2026-06-27
- [ ] **[Resilience]** Extract sitemap-entry construction (issues → entries) into a small pure, exported function and test it — the noIndex filter, slug→loc mapping, `publishedAt` slice, and null-lastmod path run only at build time, untested, while sibling pipeline pieces have tests. Impact: Medium. Effort: Medium. (`scripts/prerender.mjs:137-162`) — added 2026-06-27
- [ ] **[Cleaner]** Derive the sitemap from `ROUTES` instead of re-listing the static URLs and re-implementing the noIndex filter — indexable URLs and the indexability predicate are each declared twice in one file, so adding/renaming a route silently desyncs the sitemap. Attach sitemap meta + an `indexable` flag to the route records. Impact: Medium. Effort: Medium. (`scripts/prerender.mjs:30-89` vs `138-149`) — added 2026-06-27
- [ ] **[Resilience]** Give the sitemap write the same build-time guard every other prerender step has, and derive static-route `lastmod` instead of hardcoding date literals that go stale silently. Impact: Low. Effort: Medium. (`scripts/prerender.mjs:138-141,161`) — added 2026-06-27
- [ ] **[Cleaner]** Stop committing `public/sitemap.xml` — it is always overwritten by the build and is already a stale, divergent second source of truth. Impact: Low. Effort: Low. (`public/sitemap.xml`) — added 2026-06-27
- [ ] **[Resilience]** `robots.txt`'s `Disallow` list is hand-maintained and can drift from the actual noindex routes. Impact: Low. Effort: Low. (`public/robots.txt`) — added 2026-06-27

### 24. Security headers + CSP
- [ ] **[Consistency]** Add `https://cdn.sanity.io` to `img-src` — the enforcing CSP locks `img-src` to `'self' data:`, but Signal issue bodies render inline `<img>` straight from `cdn.sanity.io`, so the first published issue with a figure has its image silently blocked on the live, prerendered `/signal/:slug` route. (The "zero violations" soak never exercised the issue routes.) Also correct the "no third-party requests" comment. Impact: High. Effort: Low. (`customHttp.yml:16-24`, `src/components/IssueBody.jsx:26`, `scripts/fetch-issues.mjs:30`) — added 2026-06-27
- [ ] **[Security]** Pin `connect-src` to the exact checkout host instead of the region-wide `*.execute-api.us-east-2.amazonaws.com` wildcard, which lets the page reach any API Gateway in the region (incl. attacker-owned accounts) — defeating least-privilege for the checkout origin. Source it from `VITE_CHECKOUT_ENDPOINT` or front the API with a custom subdomain. Impact: Medium. Effort: Low. (`customHttp.yml:24`, `backend/checkout/template.yaml`) — added 2026-06-27
- [ ] **[Resilience]** Reconcile `connect-src` with the configured `VITE_*_ENDPOINT` origins via a build/test guard — the policy is hand-synced to the endpoints and the imminent `/apply` paid-funnel origin is guarded only by a prose comment; a mismatch silently blocks the fetch and looks like a transient network error. Impact: Medium. Effort: Medium. (`customHttp.yml:21-24`, `docs/PROJECT_STATUS.md:60-62`, `src/pages/Apply.jsx:75-88`) — added 2026-06-27
- [ ] **[Resilience]** Extend `verify-deploy.sh` to assert the security headers (HSTS, nosniff, the CSP and its `connect-src` origins) are actually served — the script exists to catch silent config degradation but never checks a single header, and this account has a known "console config doesn't auto-apply" gotcha. Impact: Medium. Effort: Low. (`scripts/verify-deploy.sh:16-49`, `customHttp.yml:4-24`) — added 2026-06-27
- [ ] **[Resilience]** Pin the "no inline executable script" invariant that `script-src 'self'` (no nonce/hash) silently relies on — add a build-time scan of every emitted `*.html` for inline `<script>`/`on*` handlers so a future bundling change that would white-screen production fails in CI, not post-deploy. Impact: Medium. Effort: Low. (`customHttp.yml:23-24`) — added 2026-06-27
- [ ] **[Security]** Add `form-action 'self'` (and consider `frame-src 'none'`) — the CSP omits `form-action`, so an injected `<form>` could POST anywhere. Impact: Low. Effort: Low. (`customHttp.yml:24`) — added 2026-06-27

### 25. CI / deploy test gate
- [ ] **[Resilience]** Wire the orphaned build-script tests into the gate — `scripts/lib/inject-head.test.mjs` (6 tests) and `scripts/fetch-issues.test.mjs` (2 tests) pass but execute in *no* gate: `npm test` globs only `backend/`, vitest includes only `src/**/*.{js,jsx}`, and CI/Amplify run only those. The prerender/head-injection/issue-normalization logic that produces production HTML ships unguarded behind a green suite. Switch to a recursive glob (`backend/**/test/*.test.mjs` + `scripts/**/*.test.mjs`). This single issue was independently surfaced by 8 of the 29 reviews. Impact: High. Effort: Low. (`package.json:11`, `vite.config.js:79`, `.github/workflows/ci.yml:19-21`) — added 2026-06-27
- [ ] **[Observability]** Make the backend gate fail on zero matched test files — `node --test` with a glob that matches nothing exits 0 ("tests 0 / pass 0 / fail 0"), so renaming/moving a backend test dir silently voids the deploy-blocking gate while staying green (vitest already exits 1 on no files). Impact: Medium. Effort: Low. (`package.json:11`, `amplify.yml:8-10`) — added 2026-06-27
- [ ] **[Resilience]** Run `npm run build` in `ci.yml` (after lint) — the PR gate never builds, so the prerender `expect`-marker and head-injection guards (the "a silently-broken render can't ship" safety net) only fire at deploy, post-merge; a build-breaking PR goes green. The build runs cleanly without secrets (`fetch-issues` degrades to `[]`). Impact: Medium. Effort: Low. (`.github/workflows/ci.yml:18-21`, `amplify.yml:15-17`, `scripts/fetch-issues.mjs:58-63`) — added 2026-06-27
- [ ] **[Security]** Harden the GitHub Actions workflow — add an explicit least-privilege `permissions:` block (default token is often read/write for a test-only job), pin third-party actions by commit SHA instead of floating major tags, and add `timeout-minutes` + a `concurrency` group. Impact: Low. Effort: Low. (`.github/workflows/ci.yml`) — added 2026-06-27
- [ ] **[Cleaner]** Single-source the Node 22 pin and the three-command test/lint gate that is copy-pasted verbatim across `amplify.yml` and `ci.yml`. Impact: Low. Effort: Low. (`amplify.yml`, `.github/workflows/ci.yml`) — added 2026-06-27
- [ ] **[Observability & cost]** Amplify caches `node_modules` but `npm ci` deletes it before reinstalling (every prod build re-downloads all deps), and the full suite+lint runs twice per merge (GitHub push CI + Amplify preBuild). Impact: Low. Effort: Low. (`amplify.yml`) — added 2026-06-27

### 26. Deploy verification script
- [ ] **[Resilience]** Fix the bundle/endpoint check — it greps the entry `index-*.js` for the checkout host, but `VITE_CHECKOUT_ENDPOINT` is read only in the lazy-loaded `Activate`/`Welcome` chunks, so the host is *never* in the entry bundle and the check prints `FAIL: …VITE_CHECKOUT_ENDPOINT is stale or unset` on every healthy API-mode deploy (regression since the 2026-06-26 lazy-load refactor; the README says run it after every deploy). Enumerate all `/assets/*.js` (or the route chunk) and match with `grep -F` (the host is currently used as a regex, so its dots match any char). Impact: High. Effort: Medium. (`scripts/verify-deploy.sh:31,40`, `src/App.jsx:18-19`, `src/pages/Welcome.jsx:7`) — added 2026-06-27
- [ ] **[Resilience]** The "SPA rewrite" probe verifies the wrong rule — it curls `/apply`, which matches the dedicated `/apply → /apply.html` prerender rewrite first, not the catch-all SPA fallback it claims to test (the most breakage-prone, hand-pasted rule). Probe a non-prerendered client route (e.g. `/welcome` or a random path) and assert the `data-route` marker instead of a generic `<div id="root"` grep; fix the stale "landing route" comment. Impact: Medium. Effort: Low. (`scripts/verify-deploy.sh:16,22-24`, `infra/amplify-rewrites.json`, `src/main.jsx:41`) — added 2026-06-27
- [ ] **[Resilience]** Add tests for the script's pure logic (the https/localhost guard, trailing-slash normalization, host extraction, bundle-name regex, exit-code contract) — it is the production deploy gate yet has no tests, while its sibling build scripts do; tests would have caught the broken bundle check above. Impact: Medium. Effort: Medium. (`scripts/verify-deploy.sh:11-14,39`) — added 2026-06-27
- [ ] **[Resilience]** Add `curl --max-time` and an explicit network-failure `FAIL` line — under `set -euo pipefail` with `-s`, a hung host hangs the script forever and a DNS/connection failure aborts with zero output instead of the script's own FAIL convention; also probe the sitemap the docs claim it checks. Impact: Low. Effort: Low. (`scripts/verify-deploy.sh:7,16,31`) — added 2026-06-27
- [ ] **[Security]** Tighten the cleartext guard — the `http://localhost*` glob over-matches remote hosts (e.g. `http://localhost.evil.com`), and the optional API base (arg 2) is curled with no scheme validation, unlike the site base. Impact: Low. Effort: Low. (`scripts/verify-deploy.sh:11-14`) — added 2026-06-27
- [ ] **[Cleaner]** De-duplicate the `/apply` double-fetch and the repeated full-flag `curl` idiom, and send `FAIL` diagnostics to stderr (not stdout) so they survive output redirection. Impact: Low. Effort: Low. (`scripts/verify-deploy.sh:16-26`) — added 2026-06-27
