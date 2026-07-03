# backend/subscribe

Double opt-in email capture for The Ground State Society. A single Lambda handles three routes — `/subscribe` writes a source-tagged pending record and fires a magic-link email via **Postmark**; `/verify` consumes the token, confirms the subscriber, and returns a signed **bearer access token** in the response body (no cookie — the API is cross-site from the quantum module); `/postmark-webhook` receives Postmark's bounce/complaint/unsubscribe events and maintains the suppression state.

Deployed as the `gss-subscribe` CloudFormation stack (SAM) in `us-east-2`, on `api.groundstatesociety.com`.

---

## Routes

### POST /subscribe

Accepts `{ "email": "...", "source": "signal" | "quantum-intro", "website": "" }`.

- Validates email format and source allowlist.
- Honeypot field `website`: if filled the request is silently accepted and dropped (bot protection).
- Writes an `EMAIL#<email>` subscriber + single-use `TOKEN#<hash>` lookup in DynamoDB (hashed magic-link token, consent IP, TTL).
- If the email is not already confirmed, sends the magic link via Postmark. The link is **source-specific**: `signal` → `SIGNAL_VERIFY_URL`, `quantum-intro` → `QUANTUM_VERIFY_URL`.
- Always returns `{ "ok": true }` — the response never reveals membership state.

### POST /verify

Accepts `{ "token": "..." }` (the raw token from the magic link).

- Hashes the token with `TOKEN_PEPPER`, atomically consumes (single-use) the `TOKEN#` lookup, and promotes the subscriber to confirmed.
- Returns `{ "ok": true, "token": "<signed bearer token>" }`. The Signal `/confirm` page ignores the token (confirming the address is all it needs); the quantum module stores it and sends it as `Authorization: Bearer` to the content API (Plan 2).
- Returns `{ "error": "invalid_token" }` on any mismatch, reuse, or expiry — no information disclosure, no cookie on any response.

### POST /postmark-webhook

Postmark's event webhook (registered on the `outbound` stream; Postmark does not sign webhooks, so the endpoint uses **HTTP Basic auth** — user `postmark`, password `POSTMARK_WEBHOOK_SECRET`; timing-safe compare; fails closed with a `503 webhook_not_configured` + alarmed `webhook_rejected` log if the secret is unset, and a quiet `401` for bad credentials so internet scanners can't page the operator).

- `SpamComplaint` and hard `Bounce` events write a **permanent `suppressed` tombstone** (no TTL) keyed `EMAIL#<addr>`; `createPending` refuses to resurrect a suppressed address, so a complainer is never emailed again.
- `SubscriptionChange` with `SuppressSending=true` (one-click unsubscribe on the broadcast stream) marks the address `unsubscribed` — re-subscribable by the user, unlike suppression.
- Always returns `200` for events it ignores (deliveries, opens, soft bounces) so Postmark stops retrying.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `TABLE_NAME` | yes | DynamoDB table name (injected by CloudFormation). |
| `SECRETS_ARN` | yes (deployed) | ARN of the Secrets Manager secret (JSON: `SESSION_SECRET` — HMAC for the bearer token; `TOKEN_PEPPER` — pepper for magic-link hashes; `POSTMARK_TOKEN` — Postmark Server API Token for the sender; `POSTMARK_WEBHOOK_SECRET` — Basic-auth password for `/postmark-webhook`). Fetched at cold start so none is a Lambda env var. **Locally**, set them directly in `.env.local` instead — those take precedence and no secret is fetched. |
| `FROM_ADDRESS` | yes | Postmark-verified sender, e.g. `no-reply@groundstatesociety.com`. |
| `SIGNAL_VERIFY_URL` | yes | Confirmation landing page for `source=signal` (`https://groundstatesociety.com/confirm`). |
| `QUANTUM_VERIFY_URL` | yes | Confirmation landing page for `source=quantum-intro` (`https://quantum.altivum.ai/verify`). |
| `SESSION_TTL_SEC` | no | Bearer token lifetime in seconds (default `2592000` = 30 days). |

Set secrets in `.env.local` for local development. Never commit them.

---

## Email (Postmark)

The magic-link confirmation is sent via **Postmark's HTTPS Email API** (`email.mjs`, no SDK — Node 22 global `fetch`, bounded by an 8 s `AbortSignal.timeout`), on the **`outbound` transactional Message Stream**. The stream is kept separate from the "Signal" broadcast stream (used by `backend/broadcast/`) so the newsletter can never share the confirmation email's sender reputation. Postmark was chosen during the period SES production access was denied; SES access was later **GRANTED** (case `178181335200610`, 50k/day) and SES is kept as a **documented fallback** (identity + DKIM + custom MAIL FROM remain in place) — Postmark stays primary for its transactional inbox placement and Message Streams isolation.

**Setup:**
- Verify the sending domain (e.g. `groundstatesociety.com`) in Postmark — add Postmark's DKIM + Return-Path CNAMEs to the GSS Route 53 zone `Z00828413P9V0JNO3MQGW`.
- Create a Postmark **Server** and put its **Server API Token** into the `gss/subscribe` Secrets Manager secret as `POSTMARK_TOKEN` (the handler hydrates it at cold start; never a plaintext env var).
- `FROM_ADDRESS` must be an address on a Postmark-verified domain.

**Suppression (shipped, live-verified 2026-06-25):** `POST /postmark-webhook` (see Routes) is registered in Postmark on the `outbound` stream's Webhooks — Bounce + SpamComplaint enabled, Basic auth `postmark` / `POSTMARK_WEBHOOK_SECRET`, message content off. Suppressed addresses get a permanent DynamoDB tombstone and can never be re-emailed by this flow; Postmark's own suppression list is a second, independent net.

---

## Local development

Run the handler on port 8788 without deploying:

```bash
node --env-file=../../.env.local local.mjs
```

The harness wraps the Lambda handler in a plain HTTP server. CORS is set to the caller's `Origin` (permissive for local use; the deployed stack uses `CorsConfiguration` on the HttpApi). Minimal `.env.local`:

```
TABLE_NAME=local-dev          # not used unless you wire a real table
SESSION_SECRET=dev-secret-32-chars-min
TOKEN_PEPPER=dev-pepper-32-chars-min
POSTMARK_TOKEN=your-postmark-server-api-token
FROM_ADDRESS=no-reply@groundstatesociety.com
SIGNAL_VERIFY_URL=http://localhost:5173/confirm
QUANTUM_VERIFY_URL=http://localhost:5174/verify
```

---

## Running the test suite

From the repo root, `npm test` runs both `backend/checkout` and `backend/subscribe` suites (a red suite blocks the Amplify deploy). From this directory: `node --test "test/*.test.mjs"`.

---

## Deploy

Prerequisites:
- AWS CLI for `us-east-2` (profile `ground-state` → account 659220242594).
- A **regional** ACM certificate for `api.groundstatesociety.com` in `us-east-2` (HttpApi custom domains require a regional cert, not us-east-1). Already ISSUED: `arn:aws:acm:us-east-2:659220242594:certificate/2e5eadf0-0d78-4c5b-8db5-3e6cd8ba0bad`.
- A Secrets Manager secret holding `{"SESSION_SECRET":"…","TOKEN_PEPPER":"…","POSTMARK_TOKEN":"…","POSTMARK_WEBHOOK_SECRET":"…"}` (SESSION_SECRET, TOKEN_PEPPER, and POSTMARK_WEBHOOK_SECRET each `openssl rand -hex 32`; POSTMARK_TOKEN from the Postmark Server); pass its ARN as `SubscribeSecretsArn`.

```bash
# one-time: create the secret holding the signing secret, pepper, Postmark token,
# and the webhook Basic-auth password
aws secretsmanager create-secret --name gss/subscribe --region us-east-2 --profile ground-state \
  --secret-string "{\"SESSION_SECRET\":\"$SESSION_SECRET\",\"TOKEN_PEPPER\":\"$TOKEN_PEPPER\",\"POSTMARK_TOKEN\":\"$POSTMARK_TOKEN\",\"POSTMARK_WEBHOOK_SECRET\":\"$POSTMARK_WEBHOOK_SECRET\"}"

sam build
sam deploy --profile ground-state \
  --parameter-overrides \
    SubscribeSecretsArn="$SUBSCRIBE_SECRETS_ARN" \
    ApiCertArn="$API_CERT_ARN" AlarmEmail="$ALARM_EMAIL" \
    ReservedConcurrency=-1
```

`ReservedConcurrency=-1` omits the reserved-concurrency cap — required while the account's total Lambda concurrency quota is still 10 (increase to 1000 requested). Defaults cover `FromAddress`, `SignalVerifyUrl`, `QuantumVerifyUrl`, `ApiDomainName`.

After the first deploy, point `api.groundstatesociety.com` at the `RegionalDomainTarget` output (A/ALIAS in the 659-owned `groundstatesociety.com` zone, `Z00828413P9V0JNO3MQGW`):

```bash
aws cloudformation describe-stacks --stack-name gss-subscribe --region us-east-2 \
  --profile ground-state --query "Stacks[0].Outputs"
```
