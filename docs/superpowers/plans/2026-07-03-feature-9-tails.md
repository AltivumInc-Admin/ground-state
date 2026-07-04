# Feature 9 tails — Stripe Checkout Lambda observability + error-path batch (plan, 2026-07-03)

Source: the remaining open feature-9 findings from the Category D audit in
`docs/feature-optimization.md` (4 Medium + 4 Low; the fetch timeout shipped in
#45). This closes Category D completely.

## Objective

The checkout Lambda's failure *detection* catches up to its failure *handling*:
webhook rejections stop being invisible (a wrong live-mode signing secret
currently stops the membership ledger with zero trace), `/session` stops paging
the operator for benign scanner-triggerable 404s while logging nothing for real
network failures, every Stripe-call failure is logged exactly once by one layer,
and the alarm's log-term contract plus the webhook's durability path get pinned
by tests. One code+template PR, one changeset-reviewed stack deploy.

## Prerequisites

- Read: `backend/checkout/src/handler.mjs` (whole), `template.yaml:180-240`
  (filter + alarms), `test/handler.test.mjs` (esp. the idempotency pair at
  ~:355-381 — they stub via `t.mock.method(ddb, 'send', ...)` on the exported
  object, which CONSTRAINS the lazy-import refactor), `samconfig.toml` (stale
  header), and subscribe's #45 treatment of the same webhook-rejection problem
  (`backend/subscribe/src/handler.mjs` postmarkWebhook + its filter) as the
  fleet precedent.
- Deploy params for gss-stripe-checkout captured 2026-07-03 (reuse verbatim;
  only code + the filter change).

## Step-by-step

1. [M] Webhook rejections become loud (mirrors subscribe's #45 fix)
   1.1. In `webhook()`, before each of the three silent returns, emit the
        house-style structured log:
        `console.error(JSON.stringify({ at: 'webhook_rejected', reason: 'not_configured' | 'invalid_signature' | 'invalid_payload' }))`
        — never any payload content (attacker-controlled; keep it PII- and
        injection-free).
   1.2. `template.yaml` FilterPattern gains the term:
        `?"\"at\":\"webhook_rejected\""`.
   1.3. DECISION (recommended: alarm all three): unlike subscribe — where
        bad Basic-auth creds stay a quiet 401 because only scanners send them —
        checkout's `invalid_signature` is ALSO what every REAL Stripe delivery
        produces when the signing secret is wrong, and the live-mode secret
        cutover is a known upcoming event. A few scanner-induced false alarms
        pre-launch beat a silent dead ledger; Stripe's failing-webhook emails
        are the independent second net. Encode the reasoning in a comment next
        to the filter term; revisit (split the metric) only if noise
        materializes post-launch.
2. [M] One layer logs Stripe failures; `/session` alarm calibration fixed
   2.1. `stripeRequest(method, path, params, { expectStatuses = [] } = {})`:
        (a) wrap the fetch itself so a NETWORK throw (incl. the #45 timeout)
        logs `{ at: 'stripe_error', path, network: true, name, message }` once
        and rethrows; (b) the existing !res.ok log is SKIPPED when `res.status`
        is in `expectStatuses` (still throws `{ status }` so callers branch).
   2.2. `getSession` calls `stripeRequest('GET', ..., undefined,
        { expectStatuses: [404] })` — the benign, publicly-triggerable 404
        stops paging the operator; its catch keeps mapping 404 → `not_found`
        and everything else → 502 (now WITH the stripe_error log it lacked for
        network failures).
   2.3. `createCheckout` wraps its `stripeRequest` call: catch → return
        `json(502, { error: 'upstream_error' })` directly. stripeRequest
        already logged; `at:"unhandled"` is reserved for genuinely unexpected
        throws. Each layer now has one job: stripeRequest logs Stripe
        failures, callers map them to responses, the router catches surprises.
   2.4. Update the two existing network-failure tests (socket hang up, #45
        timeout): still 502 `upstream_error`, but now assert the single
        `stripe_error` log line (network:true) and NO `unhandled` line.
3. [M] Webhook durability test — mirror the idempotency pair's setup:
   `EVENTS_TABLE` set, valid signature, `t.mock.method(ddb, 'send')` throwing a
   GENERIC error → assert 502 `upstream_error` + the `unhandled` log (this is
   the rethrow-so-Stripe-retries contract; a claim failure must NOT ack the
   event).
4. [L] Enrich the catch-all log — router catch becomes
   `{ at: 'unhandled', route: path, name: err?.name, message: err?.message }`
   (fleet shape: subscribe/apply both carry `route`; `name` distinguishes
   TimeoutError/TypeError at a glance).
5. [L] Alarm log-term contract test (drift guard both directions): a test that
   reads `template.yaml`, extracts every quoted term from
   `CheckoutFailureMetricFilter`'s FilterPattern, unescapes it, and asserts the
   literal appears in `handler.mjs` source — renaming a log tag or a filter
   term alone fails the suite.
6. [L] samconfig.toml header — replace the stale instructions (they name
   `StripeSecretKey=`/`StripeWebhookSecret=` CFN params deleted in the Secrets
   Manager cutover) with the real invocation: `sam deploy --parameter-overrides
   "CheckoutSecretsArn=..." "PriceMonthly=..." "PriceAnnual=..." ...` matching
   README's documented deploy.
7. [L] Lazy DynamoDB SDK — seam-preserving version ONLY: export `ddb` as a thin
   delegate `{ async send(cmd) { ... } }` whose real DocumentClient (and the
   `PutCommand` import) initialize on first use via a memoized dynamic import;
   `claimEvent` builds the command through the same lazy module. Tests keep
   stubbing `t.mock.method(ddb, 'send', ...)` unchanged. If the delegate fights
   the SDK's command serialization in any way, DEFER this item with reason
   (micro cold-start win vs payments-path churn) rather than force it.
8. Gate + ship: `npm test` (all suites) → PR → CI → user merge → `sam build` +
   `--no-execute-changeset` review (expect Modify CheckoutFunction +
   MetricFilter + Api, zero replacements) → execute → live probes:
   `POST /webhook` with no signature → 400 AND the `webhook_rejected` line
   visible via `aws logs filter-log-events`; `GET /session?session_id=cs_test_<junk-but-valid-format>`
   → 404 with NO stripe_error line (calibration verified live); docs check-offs.

## File & code changes

| Action | File | Change |
|---|---|---|
| Modify | `backend/checkout/src/handler.mjs` | webhook_rejected logs; stripeRequest network-log + expectStatuses; createCheckout catch; enriched unhandled; lazy-ddb delegate |
| Modify | `backend/checkout/template.yaml` | webhook_rejected filter term + trade-off comment |
| Modify | `backend/checkout/samconfig.toml` | real deploy instructions |
| Modify | `backend/checkout/test/handler.test.mjs` | durability test; rejection-log tests; updated network tests; filter-contract test |

## Testing & validation

Unit: the four test groups above (+ existing 30-ish checkout tests green).
Live (step 8): the two probes — a signatureless webhook POST leaving a visible
`webhook_rejected` log, and a well-formed-but-nonexistent session id returning
404 with no alarmed line. Rollback: revert + redeploy previous build.

## Risk & mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| This is the (test-mode) payments path | — | High if botched | Full suite incl. the signature/idempotency tests; changeset review; live probes; alarms now actually page |
| Scanner noise on the alarmed invalid_signature | Med | Low | Deliberate pre-launch trade-off (step 1.3), documented at the filter; Stripe emails are the second net |
| Lazy-ddb delegate breaks command serialization | Low | Med | Seam-preserving design; explicit defer-with-reason fallback |
| createCheckout catch swallows non-Stripe bugs inside stripeRequest | Low | Low | Only stripeRequest's own throws are caught; JSON/validation guards run before it |

## Dependencies & order

Step 2 before 3/4 (shared error-path text); 1 and 5–7 independent; 8 last.
No interaction with Category F or the Amplify flag.

## Estimated effort

Complexity: Medium. Time: 2–3 h including deploy + live probes. Files: 4.

# MISSION BRIEF

Overview: one PR + one stack deploy closes the final open Category D findings —
after this, every category except F is fully audited AND fully executed.

Execution order: seam-light code first (1, 2, 4), tests (3, 5), docs/config
tail (6, 7), then ship (8).

Decision points:
  - Alarm `invalid_signature` (recommended yes — the wrong-live-secret case
    outweighs scanner noise pre-launch; documented for post-launch revisit).
  - Item 7's lazy-ddb: implement only if the test seam survives cleanly;
    defer-with-reason is the sanctioned fallback.

Total estimated effort: 2–3 hours.
