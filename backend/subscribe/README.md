# backend/subscribe

Double opt-in email capture for The Ground State Society. A single Lambda handles two routes — `/subscribe` writes a source-tagged pending record and fires a magic-link email via SES; `/verify` consumes the token, confirms the subscriber, and returns a signed **bearer access token** in the response body (no cookie — the API is cross-site from the quantum module).

Deployed as the `gss-subscribe` CloudFormation stack (SAM) in `us-east-2`, on `api.groundstatesociety.com`.

---

## Routes

### POST /subscribe

Accepts `{ "email": "...", "source": "signal" | "quantum-intro", "website": "" }`.

- Validates email format and source allowlist.
- Honeypot field `website`: if filled the request is silently accepted and dropped (bot protection).
- Writes an `EMAIL#<email>` subscriber + single-use `TOKEN#<hash>` lookup in DynamoDB (hashed magic-link token, consent IP, TTL).
- If the email is not already confirmed, sends the magic link via SES. The link is **source-specific**: `signal` → `SIGNAL_VERIFY_URL`, `quantum-intro` → `QUANTUM_VERIFY_URL`.
- Always returns `{ "ok": true }` — the response never reveals membership state.

### POST /verify

Accepts `{ "token": "..." }` (the raw token from the magic link).

- Hashes the token with `TOKEN_PEPPER`, atomically consumes (single-use) the `TOKEN#` lookup, and promotes the subscriber to confirmed.
- Returns `{ "ok": true, "token": "<signed bearer token>" }`. The Signal `/confirm` page ignores the token (confirming the address is all it needs); the quantum module stores it and sends it as `Authorization: Bearer` to the content API (Plan 2).
- Returns `{ "error": "invalid_token" }` on any mismatch, reuse, or expiry — no information disclosure, no cookie on any response.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `TABLE_NAME` | yes | DynamoDB table name (injected by CloudFormation). |
| `SECRETS_ARN` | yes (deployed) | ARN of the Secrets Manager secret (JSON: `SESSION_SECRET` — HMAC for the bearer token; `TOKEN_PEPPER` — pepper for magic-link hashes; `POSTMARK_TOKEN` — Postmark Server API Token for the sender). Fetched at cold start so none is a Lambda env var. **Locally**, set `SESSION_SECRET`, `TOKEN_PEPPER`, and `POSTMARK_TOKEN` directly in `.env.local` instead — those take precedence and no secret is fetched. |
| `FROM_ADDRESS` | yes | Postmark-verified sender, e.g. `no-reply@groundstatesociety.com`. |
| `SIGNAL_VERIFY_URL` | yes | Confirmation landing page for `source=signal` (`https://groundstatesociety.com/confirm`). |
| `QUANTUM_VERIFY_URL` | yes | Confirmation landing page for `source=quantum-intro` (`https://quantum.altivum.ai/verify`). |
| `SESSION_TTL_SEC` | no | Bearer token lifetime in seconds (default `2592000` = 30 days). |

Set secrets in `.env.local` for local development. Never commit them.

---

## Email (Postmark)

The magic-link confirmation is sent via **Postmark's HTTPS Email API** (`email.mjs`, no SDK — Node 22 global `fetch`), on the **`outbound` transactional Message Stream**. The stream is kept separate from any future "Signal" broadcast stream so the newsletter can never share the confirmation email's sender reputation. Chosen over Amazon SES because SES production access kept being **denied at the account/identity level** (`sesv2 get-account` ReviewDetails: `DENIED`, case `178181335200610`); Postmark also has the best independent cold-start inbox placement for this premium-transactional use case.

**Setup:**
- Verify the sending domain (e.g. `groundstatesociety.com`) in Postmark — add Postmark's DKIM + Return-Path CNAMEs to the GSS Route 53 zone `Z00828413P9V0JNO3MQGW`.
- Create a Postmark **Server** and put its **Server API Token** into the `gss/subscribe` Secrets Manager secret as `POSTMARK_TOKEN` (the handler hydrates it at cold start; never a plaintext env var).
- `FROM_ADDRESS` must be an address on a Postmark-verified domain.

**TODO (fast-follow):** a `POST /postmark-webhook` route (Basic-auth verified) for `Bounce` + `SpamComplaint` events that marks addresses suppressed in DynamoDB — replaces the old SES configuration-set → SNS flow. Until then, Postmark's own suppression list already prevents re-sending to bounced/complained addresses.

**Legacy SES (rollback path):** the SES identity (`groundstatesociety.com`, DKIM + custom MAIL FROM) is left in place during cutover; remove the SES wiring only after Postmark inbox placement is verified end-to-end. The old config set `gss-subscribe` → SNS is now unused.

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
- A Secrets Manager secret holding `{"SESSION_SECRET":"…","TOKEN_PEPPER":"…","POSTMARK_TOKEN":"…"}` (SESSION_SECRET + TOKEN_PEPPER each `openssl rand -hex 32`; POSTMARK_TOKEN from the Postmark Server); pass its ARN as `SubscribeSecretsArn`.

```bash
# one-time: create the secret holding the signing secret, pepper, and Postmark token
aws secretsmanager create-secret --name gss/subscribe --region us-east-2 --profile ground-state \
  --secret-string "{\"SESSION_SECRET\":\"$SESSION_SECRET\",\"TOKEN_PEPPER\":\"$TOKEN_PEPPER\",\"POSTMARK_TOKEN\":\"$POSTMARK_TOKEN\"}"

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
