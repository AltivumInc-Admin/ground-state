# Free email-gated access to the Quantum Intro module — Design Spec

**Date:** 2026-06-17
**Author:** Christian Perez (with Claude Code)
**Status:** Design — awaiting review before implementation planning
**Repos in scope:**
- `ground-state` (this repo, `groundstatesociety.com`) — owns the shared email-capture backend + the "Signal" capture form
- `quantum-computing` (`/Users/cperez/dev/altivum-dev/quantum`, `quantum.altivum.ai`) — the learning module; changes handed off as a brief (Section 12)

---

## 1. Goal

Make the *Introduction to Quantum Computing* learning module free to anyone who completes a
zero-friction sign-up requiring **no more than an email address (no password)**, and capture
those emails into one unified, source-tagged list. The module is the tangible deliverable of the
existing free **"The Signal"** tier described in `ground-state/.altivum/intent.md`.

## 2. Locked decisions (confirmed with the user)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Sign-up friction | **Double opt-in (magic link)** via Amazon SES. Email → "check your inbox" → click signed link → access. No password. |
| D2 | Email list | **One unified list, tagged by source** (`signal` \| `quantum-intro`). Both properties write to the same backend/table. |
| D3 | Enforcement | **Server-enforced.** Protected content must not be retrievable via devtools, view-source, or direct asset URLs. |
| D4 | Lab notebooks | **Gate the solutions too.** Starter/exercise notebooks stay public; full solution notebooks move behind the gate; the no-leak CI test covers `/lab`. |

Applied defaults (user approved, override anytime): **session TTL 30 days** (instant revocation
available), **WAF deferred** to post-launch, **one shared capture stack** both properties point at,
**custom MAIL FROM subdomain** for DMARC alignment.

## 3. Chosen architecture: "Authorizing Content API" (Architecture B)

**Keep AWS Amplify Hosting for both sites. Never ship the protected bytes into the static build.
Serve lesson prose and solution notebooks at runtime from an authorizing API gated by an HttpOnly
session cookie.**

### Why B over the alternatives

Three independent design candidates were generated and scored by a three-lens judge panel
(enforcement rigor / simplicity / fit-and-migration-risk). B won all three lenses (8/8/8).

- **D3 is fundamentally incompatible with Amplify Hosting's native capabilities.** Amplify's only
  built-in access control is a single shared basic-auth username/password per branch; its CloudFront
  distribution is opaque (you cannot attach Lambda@Edge, CloudFront Functions, or signed-cookie key
  groups). *Verified:* https://docs.aws.amazon.com/amplify/latest/userguide/access-control.html
- The two edge-enforcing alternatives (A: self-controlled CloudFront + native signed cookies; C:
  CloudFront + Lambda@Edge JWT validation) both require **moving the module off Amplify** onto your
  own S3 + CloudFront, with a **DNS cutover** and an **ACM cert pinned to us-east-1**, plus
  (for C) Lambda@Edge pinned to us-east-1. *Verified:*
  https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-at-edge-function-restrictions.html
- **B sidesteps all of it:** if the protected bytes are never in `out/`, there is nothing to bypass.
  It stays **100% in us-east-2**, keeps Amplify CI/CD, and reuses the team's proven dependency-free
  SAM-Lambda pattern (`backend/checkout`).
- B is also the only design with **mechanically verifiable no-leak** (a CI test that fails the build
  if protected prose appears in the public artifact) and **instant per-user revocation** (the
  authorizer checks a strongly-consistent DynamoDB denylist + `status=confirmed` on every request).

### The tradeoff being accepted

On `/learn/[section]`, lesson bodies change from *baked into static HTML at build* to *fetched at
runtime after verification*. Consequences:
- Lesson prose is no longer in page source → **not indexable by Google, slower first paint on lessons.**
  For gated content this is desired, not a regression. The **public shell** (home, intro, nav,
  marketing) stays static, fast, and indexed.
- A small slice of the module's 443-test Jest suite that asserts on build-time-rendered lesson prose
  will need updating to the runtime-fetch model.

## 4. Non-goals / boundaries

- This **gates acquisition, not redistribution.** A verified member can copy their cookie or the
  fetched content and share it. That is true of essentially all web auth; for free content it is an
  accepted limit, and instant revocation is the lever if a credential is abused. We will not build DRM.
- No member portal, dashboard, profile, or password. Email + consent + source only (data minimization).
- The `ground-state` landing site only ever performs the **credential-less capture POST**. It never
  holds a session, never reads gated content. All session/credentialed traffic lives in the
  `altivum.ai` world (the module).
- Respect the `ground-state` intent: the gate UI is quiet and honest — no popups, countdowns, fake
  scarcity, or emoji.

## 5. End-to-end flow

1. Visitor submits **email** — on the module gate **or** the ground-state Signal form — to the shared
   `POST /subscribe`, with `source` set accordingly.
2. Capture Lambda validates shape/length, checks the honeypot, then `PutItem` with
   `attribute_not_exists(PK)` writing a `pending` record holding a **hashed**, single-use token
   (raw token never stored), with a **900s TTL**.
3. **SES `SendEmail`** (from the `altivum.ai` identity) sends the magic link
   `https://quantum.altivum.ai/verify?token=…`.
4. Visitor clicks → the static `/verify` page `POST`s the token (credentials included) to `POST /verify`.
5. Verify Lambda: constant-time match the hashed token, conditional `UpdateItem` (`exists AND pending`)
   → `confirmed`, remove the TTL, record `confirmedAt` + consent IP, mark the token consumed (single
   use), then **mint an HMAC-signed session** and set an **HttpOnly; Secure; SameSite session cookie**
   scoped to `Domain=.altivum.ai`.
6. Redirect to `/learn/<first-section>`.
7. `ProtectedLesson` (client) `fetch`es `GET /content?section=…` with credentials → **REQUEST
   authorizer** validates the cookie HMAC + expiry + `status=confirmed` + jti not in denylist → Lambda
   returns the section markdown (+ gated notebook payloads). On 401/403 it renders the gate prompt.
8. Public shell on Amplify: unchanged.

## 6. Components (each with one clear responsibility)

| Component | Lives in | Responsibility | Depends on |
|-----------|----------|----------------|------------|
| Capture Lambda (`/subscribe`) | new SAM stack, us-east-2 | Validate + honeypot + rate-guard; write `pending`; trigger SES magic link | DynamoDB, SES, Secrets (token pepper) |
| Verify Lambda (`/verify`) | same stack | Validate single-use token; flip to `confirmed`; mint + set session cookie | DynamoDB, Secrets (session secret) |
| Content authorizer | content-api stack | Per-request: validate session cookie, `confirmed`, jti-denylist | DynamoDB (SC read), Secrets |
| Content Lambda (`/content`) | content-api stack | Return section markdown + gated notebook bytes for an authorized request | private content store (Lambda bundle or private S3) |
| `subscribers` table | DynamoDB, us-east-2 | Unified, source-tagged list + double-opt-in lifecycle + consent record + revocation denylist | — |
| SES identity + config set | us-east-2 | Deliver transactional magic-link emails; bounce/complaint handling | SNS, suppression list |
| Signal form (existing) | `ground-state/src/sections/FinalCta.jsx` | Credential-less capture POST, `source: 'signal'` | `/subscribe` |
| `ProtectedLesson` (client) | `quantum-computing` module | Fetch + render gated lesson; show gate when unauthorized | `/content` |
| `SubscribeGate` / `GatePrompt` / `/verify` page | module | Quiet email-wall UI + verification landing | `/subscribe`, `/verify` |
| No-leak CI test | module CI | Fail the build if protected prose / solution notebooks appear in `out/` | — |

## 7. Data model — `subscribers` (DynamoDB, us-east-2, PAY_PER_REQUEST)

Single table. Primary item per subscriber:

```
PK            = "EMAIL#<lowercased-email>"
status        = "pending" | "confirmed" | "unsubscribed"
source        = "signal" | "quantum-intro"      # immutable; first writer wins via attribute_not_exists
tokenHash     = HMAC(token, TOKEN_PEPPER)        # raw magic-link token is NEVER stored
tokenConsumedAt = <epoch>                         # single-use enforcement
consentIp, consentAt                              # double-opt-in consent record
confirmedAt                                       # set when status -> confirmed
ttl           = <epoch seconds>                   # present ONLY while pending; removed on confirm
```

- **Signup:** `PutItem` with `ConditionExpression: attribute_not_exists(PK)` (idempotent; existing
  confirmed users are not downgraded). Re-subscribe of a `pending`/expired record is allowed via a
  guarded update.
- **Verify:** conditional `UpdateItem` (`attribute_exists(PK) AND status = pending AND tokenHash = …`).
- **Read paths reject** expired-but-not-yet-deleted `pending` records (don't trust TTL deletion timing).
- **Revocation denylist:** session `jti` items (e.g. `PK = "SESSION#<jti>"`) read with
  **strong consistency** by the authorizer so a revoked session is rejected immediately.
  (Strongly-consistent reads cost 2× RCUs and add minor latency per authorizer call — acceptable.)

## 8. Token & session design

- **Magic-link token:** single-use, short TTL (~15 min), high-entropy random, stored **hashed**
  (HMAC under `TOKEN_PEPPER`), never logged. Consumed atomically at verify.
- **Session credential:** compact HMAC-signed value (jti, sub=email-hash, exp) in an
  **HttpOnly; Secure** cookie, **30-day** expiry, `Domain=.altivum.ai`. Not readable by JS.
- **SameSite:** Because the content/verify API gets a **custom domain under `altivum.ai`**
  (e.g. `api.altivum.ai`), the page (`quantum.altivum.ai`) and the API are **same registrable site**
  (eTLD+1 = `altivum.ai`), so `SameSite=Lax` sends the cookie on the credentialed fetch. If the API is
  ever placed on the raw `*.execute-api.amazonaws.com` host (different site), switch to
  `SameSite=None; Secure`. **This must be verified in a real browser** before claiming it works.

## 9. APIs, CORS, and transport

- `POST /subscribe` — credential-less. **CORS `allowOrigins` = explicit two-origin allowlist**
  (`https://groundstatesociety.com`, `https://quantum.altivum.ai`). **Never `*`.**
- `POST /verify`, `GET /content` — called only from `quantum.altivum.ai`, **credentials included**.
  `allowCredentials = true` (incompatible with `*`; HTTP API emits a single
  `Access-Control-Allow-Origin`, so the explicit allowlist is required).
- **Preflight:** if any route uses `$default` + an authorizer, add an explicit **unauthenticated
  `OPTIONS /{proxy+}`** route, or browser preflight is rejected. *Verified:*
  https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-cors.html
- **Verify both origins in a browser** receive a correctly echoed `Access-Control-Allow-Origin` +
  `Access-Control-Allow-Credentials` on both preflight and the real response.

## 10. Infrastructure (new) — all core resources in us-east-2

1. **capture-verify SAM stack** — HTTP API (route throttling burst/rate ~10/20), `/subscribe`,
   `/verify`, `OPTIONS` preflight route; Node 22, arm64; reserved concurrency; mirrors
   `backend/checkout` structure, alarms, and zero-dependency style.
2. **content-api SAM stack** — REQUEST authorizer + `GET /content`; private content store.
3. **DynamoDB** `subscribers` (on-demand; TTL attribute `ttl` enabled, populated only for `pending`).
4. **SES** — `altivum.ai` domain identity, Easy DKIM, custom MAIL FROM subdomain, configuration set,
   SNS topics for bounces/complaints + a suppression handler.
5. **Secrets Manager** — `SESSION_SECRET`, `TOKEN_PEPPER` (scoped read).
6. **CloudWatch alarms + SNS** — cloned from `CheckoutFailureAlarm` / `CheckoutCrashAlarm`; confirm the
   SNS email subscription after first deploy.
7. **No** new hosting, CloudFront, OAC, edge functions, or DNS cutover for the core path.

> **WAF caveat (if/when added):** AWS WAF cannot attach to an API Gateway **HTTP API**, but it *can*
> attach directly to the **Amplify app** (per-IP protection without leaving Amplify) or to CloudFront.
> Either way the web ACL must be created in the **Global/us-east-1 (CloudFront) Region** — a Regional
> us-east-2 web ACL is incompatible with Amplify. So the "all us-east-2" property holds only while no
> WAF is attached. *Verified:* https://docs.aws.amazon.com/waf/latest/developerguide/how-aws-waf-works-resources.html

## 11. SES setup (the launch long-pole)

- Default **sandbox** allows sending only to verified addresses, **max 200 messages/24h AND max
  1 message/second**. A signup burst can brush the per-second cap while in sandbox.
- Request **production access in us-east-2 specifically** (sandbox state is per-Region), declaring
  **Transactional** mail type, acknowledging you email only people who requested it and that you handle
  bounces/complaints. First Support response ~24h; approval not guaranteed. **Start this first.**
  *Verified:* https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
- Easy DKIM + SPF via the custom MAIL FROM subdomain for DMARC alignment and deliverability.
- Subscribe the account-level **suppression list** to SNS bounce/complaint events before launch.

## 12. Module repo handoff (`quantum-computing` — paste into the other Claude Code session)

> Goal: stop baking lesson prose and solution notebooks into the static export; fetch them at runtime
> from `NEXT_PUBLIC_CONTENT_URL` only when the visitor holds a valid session. Keep `output: "export"`.

**Verified current state (do not assume — these are the real files):**
- `web/src/app/learn/[section]/page.tsx` is a server component. It calls `getContent(slug)` from
  `web/src/lib/content.ts`, which `fs.readFile`s `<repo-root>/<section.dirName>/GUIDE.md` **at build
  time**, then renders `<MarkdownRenderer content={content.markdown} />`. With `generateStaticParams`
  + `output: "export"`, the **full GUIDE.md prose is baked into `out/learn/*/index.html`** — this is
  the leak.
- `extractHeadings(content.markdown)` builds the TOC from the prose at build time (also prose-derived).
- Solution notebooks are staged into `web/public/lab/files/...` (world-readable) by the JupyterLite build.

**Edits:**
1. **Keep** `next.config.ts` `output: "export"`, `generateStaticParams`, and `generateMetadata`
   (title/description only — no prose). The route shells still pre-render (chrome, sidebar, hue, TOC
   container, notebook section frame).
2. **Refactor `learn/[section]/page.tsx`:** remove the build-time `getContent().markdown` read and the
   `<MarkdownRenderer content=… />` call. Render a new client component `<ProtectedLesson slug={slug}
   hue={hue} />` in its place. Move heading extraction (TOC) to run client-side **after** the markdown
   is fetched, so no prose-derived structure is in the static HTML.
3. **New `protected-lesson.tsx` (`'use client'`):** `fetch(`${NEXT_PUBLIC_CONTENT_URL}?section=${slug}`,
   { credentials: 'include' })`. On 200 → render `<MarkdownRenderer>` (confirm it renders correctly in a
   client context with the same plugins) + populate the TOC + render the (now-gated) notebook links. On
   401/403 → render `<GatePrompt>`. If `NEXT_PUBLIC_CONTENT_URL` is unset → render an inert preview
   (mirror the existing `NEXT_PUBLIC_TUTOR_URL` convention so the static site is unaffected pre-launch).
4. **New `subscribe-gate.tsx`, `gate-prompt.tsx`, `app/verify/page.tsx`:** the quiet email-wall, the
   "you need to sign up" state, and the static verification landing that POSTs the token to `/verify`.
   Honest, restrained copy — no popups/scarcity/emoji.
5. **Move content out of the build:** the per-section `GUIDE.md` files become inputs to the **content
   Lambda** (bundled with the Lambda or in a private S3 bucket), not files the Next build reads. Keep
   only the manifest/titles/section metadata (`content-manifest.json`, `sections.ts`) in the static
   bundle. `content.ts`'s `getContentSummary` (used for public teasers) must be reduced to non-sensitive
   teaser text only, or moved server-side.
6. **Notebooks (D4):** stage only **starter/exercise** notebooks into `web/public/lab/files/`. Move
   **solution** notebooks behind the content API (served as authorized downloads, hydrated into the
   JupyterLite filesystem after auth, or surfaced via a gated "view solution" fetch). This is the
   trickiest part because JupyterLite loads files from static paths — design the gated-notebook delivery
   explicitly during implementation planning; do not hand-wave it.
7. **Env vars:** add `NEXT_PUBLIC_SUBSCRIBE_URL` and `NEXT_PUBLIC_CONTENT_URL` (both inert until set).
8. **CI no-leak test (ship before the cutover):** run a production `next build`, then grep `web/out/`
   (including `_next/static` chunks) for a known sentence of GUIDE.md prose **and** for solution-notebook
   content/filenames; **fail the build if present.** This makes "the bytes aren't public" a verified,
   every-build invariant.
9. **Tests:** update the slice of the 443 Jest tests that assert build-time lesson prose to the
   runtime-fetch model; add a node test suite for the new components mirroring `backend/checkout`'s style.

## 13. Ground-state repo changes (this repo)

1. **Build the shared capture + verify backend** as a new `backend/` SAM stack cloned from
   `backend/checkout` (dependency-free, fail-closed, tested, alarmed). It owns `/subscribe`, `/verify`,
   and the `subscribers` table; the content-api stack can be a sibling.
2. **Wire `src/sections/FinalCta.jsx`:** point the Signal form at `/subscribe`; extend the payload to
   `{ form: 'signal', email, source: 'signal' }`; add a hidden, `aria-hidden`, `tabindex=-1`
   **honeypot** input; keep the inert preview when `VITE_SIGNAL_ENDPOINT` is unset. `src/lib/submit.js`
   (`postJson`, https-only) is reused unchanged for capture (no credentials on the capture POST).
3. **Copy:** update the success state to a **double-opt-in** message ("Check your inbox to confirm").
4. **README:** document `VITE_SIGNAL_ENDPOINT`, the unified source-tagged list, and that the quantum
   module is the deliverable of the free Signal tier.

## 14. Compliance

- **Double opt-in** (D1): record is `pending` until the magic link is clicked, then `confirmed`.
- **Consent record:** `consentIp`, `consentAt`, `source`, `confirmedAt` stored per subscriber.
- **Unsubscribe:** one-click, honored instantly; reflected as `status = unsubscribed`.
- **Privacy note** at both capture points; no pre-checked boxes.
- **SES** account-level suppression list + SNS complaint/bounce handling wired before launch.
- **Data minimization:** email + consent + source only. No passwords, no extra PII.

## 15. Abuse controls (launch set)

- Honeypot field → silent `200` when filled (no signal to the bot).
- HTTP API per-route throttling (~10 burst / 20 rate) — note: this is global per route, not per-IP.
- Per-IP / per-email heuristics inside the capture Lambda.
- Generic responses (no account enumeration: same response whether or not the email already exists).
- Single-use, 15-min, hashed magic-link token, distinct from the session cookie (OWASP guidance).
- Constant-time HMAC (`timingSafeEqual`), fail-closed.
- Strongly-consistent jti denylist for instant revocation.
- WAF (per-IP) deferred; if added, attach to the Amplify app with a us-east-1 web ACL (Section 10 caveat).

## 16. Build order (phasing)

- **Phase 0 — SES (long pole):** verify `altivum.ai`, Easy DKIM, custom MAIL FROM, config set, SNS
  bounce/complaint, **request production access in us-east-2**. Start immediately.
- **Phase 1 — capture + verify backend:** clone `backend/checkout`; exercise the real magic-link path
  (signup → email → cookie minted) in a browser.
- **Phase 2 — ground-state Signal form:** endpoint + `source` tag + honeypot + double-opt-in copy.
- **Phase 3 — module rendering refactor + content API:** **ship the no-leak CI test first**, then move
  prose behind `/content`.
- **Phase 4 — gated notebooks (D4):** split starters vs solutions; extend the no-leak test to `/lab`.
- **Phase 5 — go live:** flip env vars once SES is in production; add a revocation runbook.

## 17. Verification (per the project's "run the real thing" rule)

Before claiming done, exercise the live path end-to-end in a real browser: real signup → SES email
**actually delivered out of sandbox** → cookie minted with correct SameSite/Domain → authorizer allows
`/content` for the confirmed user and **denies** it for an unverified/unauthenticated request → confirm
`out/` contains **no** lesson prose or solution notebooks (the CI no-leak test, observed green on a real
build). Mocked SES and green unit tests are **not** sufficient evidence.

## 18. Fallback (if the rendering refactor proves too heavy)

Keep the existing static pre-rendered `/learn` pages on Amplify with no content API; add only the
capture + verify backend and a thin client-side gate. **This ships D1 (double opt-in) and D2 (unified
tagged list) but NOT D3 (server-enforced):** the prose stays in the static artifact and is readable via
view-source or direct `_next` URLs. This is only honest if the experience is **relabeled** as a soft
consent gate, not server-enforced access. Recommend against unless D3 is explicitly dropped.

## 19. Open items (defaults applied; revisit if needed)

- Session TTL: **30 days** (instant revocation makes long sessions safe).
- Per-IP WAF on `/subscribe`: **deferred** to post-launch (throttling + honeypot + Lambda heuristics at
  launch); revisit with the "WAF-on-Amplify, us-east-1 ACL" option in mind.
- One shared capture stack both properties point at: **yes** (vs two stacks writing the same table).
- Custom MAIL FROM subdomain for DMARC alignment: **yes.**
- Gated-notebook delivery mechanism (JupyterLite static-file model): **resolve during planning** — the
  one genuinely unsolved implementation detail.

---

*AWS mechanics in this spec were verified against current AWS documentation (Amplify access control,
Lambda@Edge restrictions, CloudFront/ACM region pins, SES sandbox + production access, HTTP API CORS,
WAF resource compatibility) via the AWS Documentation MCP server; doc URLs are cited inline.*
