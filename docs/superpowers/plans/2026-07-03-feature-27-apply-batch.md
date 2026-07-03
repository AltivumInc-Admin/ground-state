# Feature 27 batch — Apply intake Lambda hardening (plan, 2026-07-03)

Source: Category D audit findings for feature 27 in `docs/feature-optimization.md`.
Timing: BEFORE intake-open (the endpoint is deployed but `VITE_APPLY_ENDPOINT` is
unset, so every change here lands before any real applicant traffic).
Remaining items after Plans 0/1: the shared-secret IAM split (M), the 3×-enumerated
field set (M), the invisible honeypot drop (M), plus four Lows (weak escaper,
broken local harness, uncorrelated notify_failed, unbounded JSON parse).

## Objective

Close every remaining feature-27 finding: the apply Lambda stops holding IAM read
access to subscribe's session-signing key and pepper; the application field set
lives in exactly one module so a form change can never silently drop data; a
false-positive honeypot drop leaves an investigable trace; and the low tail
(escaper parity, working local harness, id-correlated failure logs, bounded JSON)
is cleared. One code PR + one ops step + one changeset-reviewed redeploy.

## Prerequisites

- AWS CLI profile `ground-state` (us-east-2), SAM CLI; PR #45 merged (it is).
- The deployed stack's parameter values (captured live 2026-07-03; all reused
  except `ApplySecretsArn`, which repoints to the new secret).
- Read first: `backend/apply/src/{handler,store,email}.mjs`, `template.yaml`,
  `local.mjs`, `test/*.test.mjs`, and `backend/checkout/local.mjs` (the harness
  pattern to mirror). Broadcast's `escapeHtml` (`issue-email.mjs`) is the escaper
  parity target.

## Step-by-step

1. [Security/M] Dedicated `gss/apply` secret — least privilege (ops + template)
   1.1. Create the secret with ONLY the Postmark token (same value; read it from
        the existing secret at execution time, never typed into the terminal):
        `TOKEN=$(aws secretsmanager get-secret-value --secret-id gss/subscribe --profile ground-state --region us-east-2 --query SecretString --output text | python3 -c "import json,sys; print(json.load(sys.stdin)['POSTMARK_TOKEN'])")`
        then `aws secretsmanager create-secret --name gss/apply --region us-east-2 --profile ground-state --secret-string "{\"POSTMARK_TOKEN\":\"$TOKEN\"}"`
   1.2. `template.yaml`: tighten the `ApplySecretsArn` description — drop the
        "May reuse the existing gss/subscribe secret" invitation; state that a
        dedicated `gss/apply` secret is required so the function can never read
        subscribe's SESSION_SECRET / TOKEN_PEPPER / POSTMARK_WEBHOOK_SECRET.
   1.3. The redeploy (step 8) passes `ApplySecretsArn=<gss/apply ARN>` — the IAM
        policy and env var both derive from the parameter; no other change.
2. [Cleaner/M] One field-descriptor table
   2.1. Create `backend/apply/src/fields.mjs`: `APPLICATION_FIELDS` — ordered
        `{ key, cap, label }` records for all eight fields (name 200 'Name',
        email 320 'Email' with `email: true`, company 200 'Company', role 200
        'Role', applicantType 100 'Applying as', stage 100 'Funding stage',
        modality 100 'Modality', want 2000 'What they want from the room').
        Comment: caps mirror the /apply form's maxLength attributes; labels are
        the operator-notification rows; store persists every key — adding a form
        field means adding ONE record here.
   2.2. `handler.mjs`: derive `CAPS`/`REQUIRED` from the table (non-email
        entries); keep the email special-case (regex + 320) reading its cap from
        the table.
   2.3. `email.mjs`: derive `FIELDS` (label pairs) from the table; delete the
        local literal.
   2.4. `store.mjs`: build the Item's application attributes from the table
        (`Object.fromEntries(APPLICATION_FIELDS.map(f => [f.key, app[f.key]]))`)
        spread with the metadata attrs (PK, id, status, createdAt, receivedAt,
        consentIp); delete the hand-listed literal.
   2.5. Drift test (the point of the refactor): a new test asserts every table
        key appears in the stored Item AND every label renders in the built
        email — so a field added to the table provably flows to both sinks.
3. [Observability/M] Honeypot trace: in the honeypot branch, before the 200,
   `console.log(JSON.stringify({ at: 'honeypot_drop', ip: clientIp(event) }))` —
   PII-free (no email/name), console.log not console.error (a trace, not an
   alarm; the metric filter is untouched). Extend the honeypot test to assert
   the log line and that the response stays `{ ok: true }`.
4. [Cleaner/L] Escaper parity: `email.mjs` `esc()` gains `.replace(/"/g, '&quot;')`
   to match broadcast's `escapeHtml` (the one duplication that has already
   drifted). Test: a value containing `"` renders as `&quot;` in the HTML body.
5. [Cleaner/L] Working local harness: rewrite `local.mjs` on checkout's pattern —
   OPTIONS preflight answered 204 with CORS headers pinned to
   `http://localhost:5173` (allow-methods POST,OPTIONS; allow-headers
   content-type), lower-cased header map, CORS headers merged onto every
   response. Keep port 8789 and the existing run instructions.
6. [Observability/L] Correlated notify_failed: `handler.mjs` keeps the store's
   return (`const { id } = await store.putApplication(application)`) and the
   catch logs `{ at: 'notify_failed', id, message: err?.message }` — closing the
   dead-return-contract finding too. Extend the Plan-1 timeout test to assert
   `line.id === 'app-id'`.
7. [Security/L] Bounded parse: before `JSON.parse`, reject
   `(event.body?.length ?? 0) > 16384` with `413 payload_too_large` (the eight
   capped fields total ~3.5 kB; 16 kB is generous headroom, and API Gateway's
   10 MB ceiling no longer reaches the parser). Test: an oversized body → 413,
   nothing stored.
8. Gate + deploy + live verification
   8.1. `npm test` green → PR → CI → user merges.
   8.2. `cd backend/apply && sam build && sam deploy --no-execute-changeset
        --parameter-overrides "ApplySecretsArn=<gss/apply ARN>" <all other
        current values as captured>` → review (expect: Modify ApplyFunction
        [env+policy+code], Modify ApplyApi; ZERO replacements) → execute.
   8.3. Live probes (no side effects): oversized body → 413 (new-code proof);
        invalid JSON → 400; honeypot POST → 200 then
        `aws logs filter-log-events --filter-pattern '"honeypot_drop"'` shows
        the trace; `aws lambda get-function-configuration` shows SECRETS_ARN =
        the gss/apply ARN.
   8.4. Check off the seven findings in docs/feature-optimization.md (+ stamp).
   8.5. Optional cleanup once verified: nothing to delete — gss/subscribe keeps
        serving the subscribe stack; apply simply no longer reads it.

## File & code changes

| Action | File | Change |
|---|---|---|
| Create | `backend/apply/src/fields.mjs` | The single field-descriptor table |
| Modify | `backend/apply/src/handler.mjs` | CAPS/REQUIRED from table; honeypot log; id-correlated notify_failed; 16 kB body guard |
| Modify | `backend/apply/src/store.mjs` | Item attrs from table |
| Modify | `backend/apply/src/email.mjs` | FIELDS from table; `"` escaping |
| Modify | `backend/apply/local.mjs` | OPTIONS preflight + pinned CORS (checkout pattern) |
| Modify | `backend/apply/template.yaml` | ApplySecretsArn description: dedicated secret required |
| Modify | `backend/apply/test/{handler,store,email}.test.mjs` | Drift test; honeypot-log, notify_failed-id, escaper, 413 tests |

## Testing & validation

Unit: the drift test (table → store Item + email labels), honeypot log line,
notify_failed carries the id, `&quot;` escaping, 413 guard (nothing stored),
plus the existing 21+ apply tests unchanged. `npm test` gates CI/Amplify.
Live: step 8.3's probes — the 413 is the decisive new-code-is-serving check.
Rollback: revert commit + redeploy previous build; the secret repoint reverses
by redeploying with the old ARN (gss/subscribe remains intact throughout).

## Risk & mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Secret repoint breaks cold-start token fetch | Low | High (notifications stop) | Handler reads `secrets.POSTMARK_TOKEN` — same key in the new secret; live honeypot+log probe after deploy; notify_failed alarm now actually pages |
| Field-table refactor changes stored shape | Low | Med | Table ordered to reproduce today's exact Item/email; existing tests pin both; drift test locks the future |
| 16 kB cap rejects a legitimate application | Very low | Med | Max legitimate payload ~3.5 kB + JSON overhead; 4× headroom; 413 is distinct and diagnosable |
| Changeset touches more than function+API | Low | Med | --no-execute-changeset review gate, as for every deploy this week |

## Dependencies & order

1.1 (secret creation) any time before 8.2; steps 2–7 are one branch/PR in any
internal order (2 before 6 in the same files); 8 strictly last. Nothing here
blocks — or is blocked by — the feature 11 or feature 9 batches.

## Estimated effort

Complexity: Medium (the field-table refactor is the only structural piece).
Time: 2–4 hours including deploy + live verification.
Files: 1 created, 6 modified (+3 test files).

# MISSION BRIEF

Overview: one PR + one secret + one redeploy closes every remaining feature-27
finding while the endpoint still has zero real traffic.

Execution order: secret (1.1) → code+tests (2–7, one branch) → PR/CI/merge →
changeset-reviewed redeploy → live probes → docs check-off.

Decision points:
- 16 kB body cap (vs 8/32) — generous 4× headroom over the max legitimate payload.
- Honeypot trace logs the source IP (PII-light, standard abuse-triage) — drop
  the ip field if you'd rather log nothing but the event.
- The gss/apply secret reuses the same Postmark token value (per the audit:
  the shared token is not the coupling problem; the co-located subscribe
  secrets are). Rotating the token is out of scope.

Total estimated effort: 2–4 hours.
