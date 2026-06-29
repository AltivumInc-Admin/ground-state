# Plan A — The "First Circle" cold-start sprint (+ apply-intake enabler)

_Authored 2026-06-29. Source: the 2026-06-28 strategic assessment (highest-leverage items).
Grounded in a file-level recon of `backend/subscribe/`, `backend/checkout/`, `src/pages/Apply.jsx`,
`src/lib/{submit,useIntakeSubmit}.js`, `customHttp.yml`, `scripts/check-csp.mjs`._

## Objective
Stand up real application capture (a `backend/apply/` Lambda that stores each application and emails it
to the operator), flip `/apply` from its honest "nothing was stored" preview to live, then run a
disciplined recruiting sprint to hand-build **one coherent circle of ~6** in a single stage+modality
slice — committing members before charging, with a pre-set kill-criterion so a half-empty circle never
ships. When done: a founder can apply and the operator receives it; and there is a real, full first
circle (or a clear, fast "no-go" signal).

## Prerequisites
- AWS CLI + SAM CLI authenticated as profile `ground-state` (acct `659220242594`); Amplify console
  access (app `d2c0upa00yly4w`); the `gss/subscribe` Secrets Manager secret (holds a valid
  `POSTMARK_TOKEN`); Postmark sender domain verified.
- Decisions before deploy (see Decision Points): operator inbox address; reuse `gss/subscribe` secret
  vs. new `gss/apply`; custom domain `apply.groundstatesociety.com` (recommended) vs. raw execute-api
  host; notify-failure policy; allowlist vs. length-only validation for the select fields.
- Review: `backend/subscribe/` (the template); `PROJECT_STATUS.md` 43-64 (Secrets Manager + CSP);
  Stripe state (payments still in TEST mode — relevant when charging at quorum).
- Assumption: the recruiting motion is operator-led and manual (no growth-hacks) — brand-consistent.

## Step-by-Step Implementation

### Part 1 — Apply-intake backend (`backend/apply/`, copy-adapted from `backend/subscribe/`)
1. Scaffold the directory from the subscribe shape; strip subscribe-only crypto/token logic.
   `backend/apply/src/package.json` = `{ "name":"gss-apply","version":"1.0.0","type":"module" }` (no deps).
2. `src/store.mjs`: export `ddb`; `putApplication(record)` = single `PutCommand` to `TABLE()` with PK
   `APP#<uuid>`, `receivedAt`/`createdAt`, `status:'new'`, and the full field set — **no TTL**.
3. `src/email.mjs`: reuse the subscribe Postmark sender shape (HTTPS POST, `X-Postmark-Server-Token`,
   `MessageStream:'outbound'`, `TrackOpens:false`, `TrackLinks:'None'`), but `To` = operator inbox,
   `ReplyTo` = applicant email, body = rendered application summary; throw on non-2xx.
4. `src/handler.mjs` mirroring `makeHandler({ store, email })` DI: env-preferring Secrets Manager fetch
   at cold start (only `POSTMARK_TOKEN`); parse JSON → 400; honeypot `website` → 200 no-op; validate the
   8 fields (trim, lowercase+regex email, length caps) → 400; **store first, then notify** (notify
   failure logs `{at:'notify_failed'}` and still returns 200); top-level catch → `{at:'unhandled'}` + 502.
5. `template.yaml` adapted from subscribe + checkout's conditional domain: HttpApi (throttle 10/20, CORS
   prod origins, POST/OPTIONS), `ApplicationsTable` (PAY_PER_REQUEST, PK S, **no TTL**), Lambda
   nodejs22/arm64/256/15, `ApplySecretsArn`+`OperatorEmail` params, least-priv IAM (GetSecretValue +
   PutItem), LogGroup 365d, MetricFilter `{at:'unhandled'}`, optional SNS alarms, **conditional** custom
   domain (off until a regional ACM cert ARN is supplied), Outputs `ApiUrl`.
6. `samconfig.toml` (`stack_name=gss-apply`, us-east-2, profile `ground-state`) and `local.mjs` (port 8789).
7. `test/{handler,store,email}.test.mjs` mirroring subscribe (env before dynamic import; fakes via
   `makeHandler`; assert honeypot-drop, validation 400s, store PutCommand shape, Postmark request shape +
   throw-on-non-2xx; plus notify-failure→200 and store-failure→502).

### Part 2 — Go-live wiring
8. **Register the new test glob** (`pretest` runs `scripts/check-test-globs.mjs`): add
   `backend/apply/test` to its `TEST_DIRS` and `backend/apply/test/*.test.mjs` to the root `package.json`
   `test` script — in lockstep.
9. `cd backend/apply && sam build && sam deploy` (with `OperatorEmail` + `ApplySecretsArn`). Capture `ApiUrl`.
10. (Recommended) provision `apply.groundstatesociety.com` (regional ACM cert in us-east-2 + Route 53 to
    the regional target) and redeploy with `ApplyCertArn`.
11. Amplify console: set build env `VITE_APPLY_ENDPOINT = https://<apply-host>/apply` (full URL incl. path).
12. CSP: if the apply origin ≠ `api.groundstatesociety.com`, append it to `connect-src` in `customHttp.yml`.
    Run `VITE_APPLY_ENDPOINT=… node scripts/check-csp.mjs` to confirm the preBuild gate passes.
13. Redeploy. **Exercise the real path:** submit a live application → confirm DynamoDB record + operator
    email arrive, before announcing intake is open.

### Part 3 — The First Circle recruiting sprint (operational)
14. Pick one slice likely to yield ~6 (one stage band × one modality × densest/warmest cluster). Write the
    kill-criterion now: if it won't produce ~6 committed founders in 6-8 weeks, change the slice or revisit
    price — never open a half-empty circle.
15. Build a named target list (~30-50).
16. Reach out 1:1, personally (no mass sends, no scarcity theatre) — pitch the founding-cohort deal.
17. Run the "real conversation" vetting; verify operating-founder status.
18. **Commit-then-charge:** collect soft founding-intent commitments until quorum (~6); only then flip
    Stripe to live keys and bill at the founding rate. Track pipeline off the applications table.
19. At quorum, place the circle and start the cadence. If the kill-criterion trips first, pivot the slice.

## File & Code Changes
| Action | File Path | Description |
|---|---|---|
| Create | `backend/apply/src/handler.mjs` | DI handler: honeypot, validation, store-then-notify, 200/400/502 |
| Create | `backend/apply/src/store.mjs` | `ddb` + `putApplication` (durable `APP#…`, no TTL) |
| Create | `backend/apply/src/email.mjs` | Postmark notify → operator, ReplyTo=applicant, application summary |
| Create | `backend/apply/src/package.json` | `{type:module}`, no deps |
| Create | `backend/apply/template.yaml` | SAM: HttpApi, DynamoDB, Lambda, params, IAM, LogGroup, MetricFilter, conditional alarms + domain, ApiUrl |
| Create | `backend/apply/samconfig.toml` | `stack_name=gss-apply`, us-east-2, profile `ground-state` |
| Create | `backend/apply/local.mjs` | Local harness (port 8789) |
| Create | `backend/apply/test/{handler,store,email}.test.mjs` | Offline node:test suites |
| Modify | `scripts/check-test-globs.mjs` | Add `backend/apply/test` to `TEST_DIRS` |
| Modify | `package.json` (root) | Add `backend/apply/test/*.test.mjs` to the `test` glob |
| Modify | `customHttp.yml` | Conditional: add apply origin to `connect-src` (only if host ≠ api.groundstatesociety.com) |
| Modify | `docs/PROJECT_STATUS.md` | Flip the `/apply` row to live once verified end-to-end |
| None | `src/pages/Apply.jsx`, `src/lib/{submit,useIntakeSubmit}.js`, Apply tests | Already endpoint-aware + tested |

## Testing & Validation
- Offline: `node --test backend/apply/test/*.test.mjs`; full gate `npm test && npm run test:fe && npm run lint`.
- CSP gate: `VITE_APPLY_ENDPOINT=<url> node scripts/check-csp.mjs`; `node --test scripts/check-csp.test.mjs`.
- Local integration: run `backend/apply/local.mjs`, POST the exact frontend payload (+ honeypot variant).
- Real e2e (required before open): live submit → DynamoDB row + operator email; invalid → 400; honeypot → silent 200.
- Rollback: unset `VITE_APPLY_ENDPOINT` + redeploy → preview returns; `sam delete` tears down the stack.

## Risk & Mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| CSP host mismatch (silent block or hard build fail) | Med | Med | Pin a dedicated apply host; update connect-src; run check-csp.mjs first |
| Operator email fails after store → missed application | Low | Med | Store-first + `{at:'notify_failed'}` log + CloudWatch alarm; periodic table check |
| Spam/abuse on public POST | Med | Low | Honeypot + length caps + stage throttle; per-IP/email rate-limit noted open |
| Stripe still in TEST mode at quorum | Med | High | Plan live-key cutover as part of go-live |
| Slice too thin → half-empty circle | Med | High | Pre-set kill-criterion; pivot slice rather than open a partial circle |
| Regional ACM cert friction (us-east-2) | Med | Low | Conditional domain off by default — launch on raw endpoint, pin that origin in CSP first |

## Dependencies & Order of Operations
- Sequential: backend build+test → deploy → Amplify env + CSP → redeploy → real e2e → open intake.
- Parallelizable: recruiting target-list + outreach can run while the backend is built.
- External blockers: ACM cert; Stripe live-key activation.

## Estimated Effort
- Complexity: High. Time: backend+go-live ≈ 1-2 days; sprint ≈ 6-8 weeks (operational).
  Files: ~11 create, ~4 modify, 0 frontend.

## Decision Points
operator inbox address; reuse `gss/subscribe` secret vs new `gss/apply`; custom domain vs raw endpoint;
notify-failure policy (store-then-200 recommended — implemented); allowlist vs length-only validation;
Stripe live-key cutover timing.
