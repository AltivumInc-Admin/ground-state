# Category D execution — Plans 0/1/2 (2026-07-03)

Source: `/optimize-features D` verified audit (findings persisted in
`docs/feature-optimization.md` under features 9/10/11/27). Three plans:
0 = fleet alarm restoration (pure ops, no code), 1 = outbound-fetch timeout
sweep (all four packages), 2 = feature-10 subscribe batch (the live path).

---

## Plan 0 — Restore fleet alarm notifications (ops only, do first)

### Objective
Every alarm in the deployed fleet currently notifies nobody: `gss-apply` was
deployed with `AlarmEmail=""` (all alarms condition-disabled), and the
`gss-subscribe` + `gss-stripe-checkout` SNS alarm topics have zero
subscriptions (deploy-time confirmation emails expired unclicked — AWS deletes
pending subscriptions after ~3 days). After this plan, all three stacks alert
christian.perez@altivum.io, verified by a real test-fire.

### Prerequisites
- AWS CLI with profile `ground-state` (account 659220242594), region us-east-2.
- SAM CLI for the apply redeploy. Access to the christian.perez@altivum.io inbox
  the same day (confirmations expire).
- Topic ARNs (verified live 2026-07-03):
  - `arn:aws:sns:us-east-2:659220242594:gss-subscribe-AlarmTopic-0Vf8ja4KqB8x`
  - `arn:aws:sns:us-east-2:659220242594:gss-stripe-checkout-AlarmTopic-fIzcv5NW4s8I`

### Step-by-step
1. Re-subscribe the two existing topics (out-of-band from CFN — the CFN-managed
   Subscription resources are in an expired-pending state; a manual subscription
   on the same topic is additive and safe):
   1.1. `aws sns subscribe --topic-arn arn:aws:sns:us-east-2:659220242594:gss-subscribe-AlarmTopic-0Vf8ja4KqB8x --protocol email --notification-endpoint christian.perez@altivum.io --profile ground-state --region us-east-2`
   1.2. Same command with the checkout topic ARN.
   1.3. Open the inbox and CLICK BOTH "AWS Notification - Subscription Confirmation" emails now (this is the step that was missed at deploy time).
2. Redeploy `gss-apply` with alarms enabled (parameter-only change; all other
   values reuse the current deployed values, captured 2026-07-03):
   2.1. `cd backend/apply && sam deploy --parameter-overrides "ApplySecretsArn=arn:aws:secretsmanager:us-east-2:659220242594:secret:gss/subscribe-3XYdcZ" "OperatorEmail=apply@groundstatesociety.com" "FromAddress=no-reply@groundstatesociety.com" "ApplyDomainName=apply.groundstatesociety.com" "ApplyCertArn=arn:aws:acm:us-east-2:659220242594:certificate/e8c9d4d9-a8e4-4d63-a093-6e99e4f2817d" "ReservedConcurrency=10" "AlarmEmail=christian.perez@altivum.io"`
        (samconfig.toml pins stack/profile/region; review the changeset — it should
        create ONLY the SNS topic, subscription, metric filter, and two alarms.)
   2.2. Click the third confirmation email (apply topic).
3. Verify for real:
   3.1. `aws sns list-subscriptions-by-topic` on all three topics → each shows a
        real `SubscriptionArn` (not PendingConfirmation, not empty).
   3.2. Test-fire one alarm end-to-end:
        `aws cloudwatch set-alarm-state --alarm-name <gss-subscribe failure alarm name from describe-alarms --alarm-name-prefix gss-subscribe> --state-value ALARM --state-reason "notification test" --profile ground-state --region us-east-2`
        → confirm the email arrives, then the alarm re-evaluates back to OK on its
        own (or set it back with --state-value OK).

### File & code changes
| Action | File | Change |
|---|---|---|
| None | — | Pure ops; the only artifact is stack state. Optionally note the deploy date in docs/PROJECT_STATUS.md's backend section. |

### Testing & validation
Covered by step 3 (subscription listing + real test-fire). Rollback: `aws sns
unsubscribe` the created subscriptions; redeploy apply with `AlarmEmail=""`.

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Confirmation emails again left unclicked | Med | High (silent repeat) | Do steps 1.3/2.2 immediately; step 3.1 is the proof gate |
| Apply changeset touches more than alarms | Low | Med | Review changeset before confirming; all non-alarm params passed with current values |
| Test-fire email goes to spam | Low | Low | Check spam folder; SNS emails come from no-reply@sns.amazonaws.com |

### Dependencies & order
Independent of Plans 1–2. Do first — it protects the live path today.

### Estimated effort
Complexity: Low. Time: 15–30 min. Files: 0.

---

## Plan 1 — Outbound-fetch timeout sweep (all four packages)

### Objective
No outbound `fetch` in the backend fleet has a timeout: a hung upstream
(Stripe/Postmark/Sanity) rides to the 15 s Lambda hard kill — skipping the
designed error paths and their structured logs, and pinning reserved-concurrency
slots — or hangs the operator CLI indefinitely. One pattern fixes all four:
`AbortSignal.timeout(...)` (built into Node 22, zero dependencies), so failures
resolve inside the existing, already-tested error plumbing.

### Prerequisites
- Node 22 (AbortSignal.timeout available). No new packages.
- Read: the four call sites below. Backend deploys are manual `sam deploy`
  (CI/Amplify only gate tests) — schedule the three stack deploys.

### Step-by-step
1. Checkout (`backend/checkout/src/handler.mjs:72-79`, `stripeRequest`):
   1.1. Add `signal: AbortSignal.timeout(8000)` to the fetch init (Lambda timeout
        is 15 s; browser caller aborts at 10 s — 8 s beats both).
   1.2. Test (`backend/checkout/test/handler.test.mjs`, mirroring the existing
        'socket hang up' case at :164): mock fetch to reject with
        `Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })`
        → assert 502 + structured `stripe_error`/`upstream_error` body.
2. Subscribe (`backend/subscribe/src/email.mjs:98`, `sendMagicLink`):
   2.1. Add `signal: AbortSignal.timeout(8000)`. A timeout throws → handler
        catch-all → 502 `upstream_error` + `at:"unhandled"` log (alarmed). The
        pending row/token already written are refreshed on user retry by design.
   2.2. Test in `backend/subscribe/test/handler.test.mjs`: fake email module
        whose `sendMagicLink` rejects with a TimeoutError → 502 (this doubles as
        part of Plan 2's untested-502-contract item — write it once).
3. Apply (`backend/apply/src/email.mjs:68`, `notifyOperator`):
   3.1. Add `signal: AbortSignal.timeout(5000)` (notification is post-store;
        bound it tighter so the applicant's 200 isn't held hostage).
   3.2. Test in `backend/apply/test/handler.test.mjs`: email mock rejecting with
        TimeoutError → assert the existing store-first behavior (application
        persisted, `notify_failed` logged, response unchanged).
4. Broadcast:
   4.1. `backend/broadcast/src/postmark.mjs` batch POST: add
        `signal: AbortSignal.timeout(30000)` (CLI, 500-message batches — generous
        but bounded). NOTE: mid-run tally handling is deliberately out of scope
        here (feature-11 batch owns it); this only converts "hangs forever" into
        the existing thrown-error path.
   4.2. Sanity fetch (`fetchIssue` in `backend/broadcast/src/issue-email.mjs`):
        pass a request timeout via @sanity/client's config (`timeout` ms on
        createClient) — verify the option against the installed client version
        during implementation; if unsupported, wrap the fetch it exposes.
   4.3. Test in `backend/broadcast/test/`: sendIssue with `fetchImpl` rejecting
        TimeoutError → rejects with the existing `postmark_batch_failed` shape.
5. Gate + deploy: `npm test` green; then `sam deploy` for checkout, subscribe,
   apply (subscribe deploy can be bundled with Plan 2's — one deploy total).

### File & code changes
| Action | File | Change |
|---|---|---|
| Modify | `backend/checkout/src/handler.mjs` | `signal` on stripeRequest fetch |
| Modify | `backend/subscribe/src/email.mjs` | `signal` on Postmark fetch |
| Modify | `backend/apply/src/email.mjs` | `signal` on Postmark fetch |
| Modify | `backend/broadcast/src/postmark.mjs` | `signal` on batch POST |
| Modify | `backend/broadcast/src/issue-email.mjs` | Sanity client timeout |
| Modify | 4 × `backend/*/test/*.test.mjs` | one timeout-rejection test each |

### Testing & validation
Unit tests above; `npm test` (all backend suites in the CI glob). Live check
after deploy: `./scripts/verify-deploy.sh` still green; one real `/subscribe`
round-trip (the double-opt-in flow) to confirm no regression on the live path.
Rollback: revert commit + redeploy previous template/code (sam deploy of the
prior commit).

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Timeout too tight for a slow-but-succeeding Postmark/Stripe call | Low | Med | 8 s is ~40× typical API latency; failures land in retryable, user-visible error paths |
| @sanity/client version lacks `timeout` | Low | Low | Checked at implementation; fallback wraps fetch |
| Deploying three stacks invites config drift | Low | Med | samconfig pins per stack; changesets reviewed; verify-deploy + live round-trip after |

### Dependencies & order
Independent of Plan 0. Do before Plan 2 or together (subscribe package overlaps
— same PR or stacked commits, ONE subscribe deploy at the end).

### Estimated effort
Complexity: Low. Time: 2–3 h incl. deploys + live verification. Files: ~10.

---

## Plan 2 — Feature 10 batch: the live subscribe path

### Objective
Close the remaining feature-10 findings (5 Medium + 6 Low; the timeout Medium is
Plan 1's): stop PII leaking into 365-day logs, tighten the email validation that
keys suppression, alarm every error site, test the ops-critical paths, and fix
the README that contradicts the shipped code.

### Prerequisites
- Plan 1's subscribe edits merged or in the same branch (email.mjs overlaps).
- `sam deploy` access for gss-subscribe (template.yaml changes: metric filter).
- Read first: `backend/subscribe/src/*.mjs`, `template.yaml:148-200`, `README.md`,
  `local.mjs`, `test/handler.test.mjs` (17 tests), `test/store.test.mjs` (12).

### Step-by-step
1. [Security/M] PII out of logs — `email.mjs:122-125`: replace the raw response
   body in the thrown message with status + parsed numeric ErrorCode only:
   `postmark_send_failed 422 code=406`. (Postmark's 422 body embeds the
   recipient address; the throw lands in the `at:"unhandled"` log retained 365
   days.) Update `test/email.test.mjs` to assert the redacted shape and that no
   address appears in the message.
2. [Security/M] Tighten `EMAIL_RE` — `handler.mjs:29,88`: reject angle-addr and
   display-name forms by adding one guard alongside the existing regex:
   `/[<>"(),;:]/.test(emailAddr) → 400 invalid_email` (keeps the deliberately
   simple regex, closes the stored-key-vs-delivery-address split; verified
   `IT-Support<victim@x.com>` currently passes). Tests: both forms → 400; a
   normal address still passes.
3. [Consistency/M] Metric filter covers every error site — `template.yaml:152`:
   `FilterPattern: '?"\"at\":\"unhandled\"" ?"\"at\":\"verify_consumed_unconfirmed\""'`
   (matches the checkout/apply convention of one term per error-level log site).
4. [Resilience/M] Untested ops paths — `test/handler.test.mjs` additions:
   4.1. Store throw → 502 `upstream_error` + (via mocked console.error) the
        `{"at":"unhandled","route":"/subscribe"}` single-line shape the metric
        filter matches (pins the alarm's log-term contract).
   4.2. Webhook with POSTMARK_WEBHOOK_SECRET unset → fail-closed (see step 6).
   4.3. Email-send throw → 502 (delivered by Plan 1 step 2.2 if done together).
5. [Cleaner/M] README rewrite — `backend/subscribe/README.md`: SES → Postmark in
   the intro and Routes ("two routes" → three); add POST /postmark-webhook as a
   shipped route (Basic auth, suppression semantics, SubscriptionChange sync);
   convert the line-55 TODO into current-state prose; add
   POSTMARK_WEBHOOK_SECRET to the secret recipe/env table; update the SES
   narrative (production access later GRANTED; SES kept as documented fallback —
   mirror PROJECT_STATUS.md wording).
6. [Consistency/L] Misconfiguration ≠ bad credentials — `handler.mjs:46-54`:
   when the secret is unset return 503 `webhook_not_configured` + structured
   `webhook_rejected` log (mirrors checkout's fail-closed contract; Postmark
   retries non-200s, which is what you want during a misconfig window); keep 401
   for wrong credentials.
7. [Cleaner/L] Reuse `safeEqualHex` — `webhookAuthorized` re-implements the
   length+timingSafeEqual pattern `crypto.mjs:9-13` already exports; import and
   use it (drop the direct `node:crypto` import if unused after).
8. [Cleaner/L] `isConfirmed` must not swallow infra errors — `store.mjs:123-133`:
   remove the blanket try/catch (or rethrow non-`ConditionalCheckFailedException`)
   so a DynamoDB outage surfaces as 502 (alarmed) instead of `400 invalid_token`
   (user blamed, silent). Adjust the store test that relies on the swallow.
9. [Cleaner/L] `local.mjs` cookie cleanup: drop the `cookies:` event field,
   `set-cookie` forwarding, and `allow-credentials` header — dead plumbing from
   the abandoned cookie-session design (the API is bearer-token, no cookies).
10. [Deferred, recorded in docs] The /subscribe timing side channel (Low: fixing
    it means decoupling the email send — architectural) and the template
    custom-domain-pattern parity (infra churn on a live stack) stay deferred
    with reasons; both already carry dispositions in docs/feature-optimization.md.
11. Gate + deploy: `npm test` + lint green → PR → after merge, ONE
    `sam deploy` of gss-subscribe (code + template together) → live round-trip:
    real subscribe → confirmation email → /confirm → verify; then check-off pass
    in docs/feature-optimization.md.

### File & code changes
| Action | File | Change |
|---|---|---|
| Modify | `backend/subscribe/src/email.mjs` | Redacted Postmark error (steps 1) |
| Modify | `backend/subscribe/src/handler.mjs` | EMAIL_RE guard; 503 misconfig; safeEqualHex import (2,6,7) |
| Modify | `backend/subscribe/src/store.mjs` | isConfirmed rethrow (8) |
| Modify | `backend/subscribe/template.yaml` | Metric filter second term (3) |
| Modify | `backend/subscribe/README.md` | Full doc pass (5) |
| Modify | `backend/subscribe/local.mjs` | Cookie plumbing removal (9) |
| Modify | `backend/subscribe/test/{handler,email,store}.test.mjs` | New/adjusted tests (1,2,4,6,8) |

### Testing & validation
`npm test` (the suite gates CI + Amplify preBuild). Post-deploy live checks:
full double-opt-in round-trip on production; `aws logs tail` during a forced
error is optional but the metric-filter term can be verified with
`aws logs filter-log-events --filter-pattern` against the new pattern. Rollback:
revert + redeploy previous version.

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| This is the LIVE signup path | — | High if botched | Full suite + changeset review + immediate live round-trip after deploy (Plan 0's alarms now actually notify if something breaks later) |
| EMAIL_RE tightening rejects a legitimate address form | Low | Med | Guard only rejects chars invalid in bare addr-spec local/domain use here (`<>"(),;:`); normal addresses unaffected; tests pin both sides |
| isConfirmed rethrow changes verify() semantics | Low | Low | Only on infra failure: 400→502 is the correct, alarmed behavior; test adjusted deliberately |
| Postmark retries during 503 misconfig window flood logs | Low | Low | That is the desired pressure signal; alarm fires via unhandled? no — webhook_rejected term can be added to the filter in the same pass |

### Dependencies & order
After (or with) Plan 1's subscribe edit. Steps 1–9 are one branch/PR; single
sam deploy at the end.

### Estimated effort
Complexity: Medium. Time: 3–5 h incl. deploy + live verification. Files: 7.

---

# MISSION BRIEF

Overview: restore the fleet's ability to page the operator (0), bound every
outbound call so failures land in the designed error paths (1), then harden the
one live backend surface end-to-end (2).

Execution order:
  1. Plan 0 today — pure ops, 15–30 min, protects the live path immediately;
     also makes Plans 1–2's alarm-related work observable in practice.
  2. Plan 1 — one PR across four packages; deploy checkout + apply; HOLD the
     subscribe deploy.
  3. Plan 2 — subscribe branch (stacks on Plan 1's email.mjs edit); one combined
     gss-subscribe deploy ships both plans' subscribe changes at once.

Decision points:
  - Timeout values (8s/8s/5s/30s) are judgment calls — tune at implementation.
  - Plan 2 step 6 changes the unset-secret response 401→503: confirm you want
    Postmark to retry during a misconfig window (recommended: yes).
  - Whether to add the new `webhook_rejected` log term to the metric filter in
    the same template pass (recommended: yes, one deploy).

Total estimated effort: ~6–9 hours across one ops session + two PRs + three
stack deploys (subscribe deployed once).
