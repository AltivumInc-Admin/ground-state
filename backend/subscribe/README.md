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
| `SESSION_SECRET` | yes | HMAC-SHA256 secret for signing the bearer access token. Rotate with a deploy; old tokens expire naturally. |
| `TOKEN_PEPPER` | yes | HMAC-SHA256 pepper mixed into magic-link token hashes before storage. Prevents token extraction from a leaked table. |
| `FROM_ADDRESS` | yes | SES-verified sender, e.g. `no-reply@groundstatesociety.com`. Same region as the stack. |
| `CONFIG_SET` | yes | SES configuration set (`gss-subscribe`). Routes bounce/complaint events to SNS. |
| `SIGNAL_VERIFY_URL` | yes | Confirmation landing page for `source=signal` (`https://groundstatesociety.com/confirm`). |
| `QUANTUM_VERIFY_URL` | yes | Confirmation landing page for `source=quantum-intro` (`https://quantum.altivum.ai/verify`). |
| `SESSION_TTL_SEC` | no | Bearer token lifetime in seconds (default `2592000` = 30 days). |

Set secrets in `.env.local` for local development. Never commit them.

---

## SES setup (account 659220242594, us-east-2)

**Done:**
- Domain identity `groundstatesociety.com` verified; Easy DKIM `SUCCESS`; custom MAIL FROM `mail.groundstatesociety.com` `SUCCESS`; DMARC published (`p=none`).
- Configuration set `gss-subscribe` with a `BOUNCE`+`COMPLAINT` → SNS event destination (topic `gss-ses-events`).
- Account-level suppression list on for bounces and complaints.

**Production access:** request submitted 2026-06-18 (Transactional); follow-up answered. Awaiting AWS decision — until granted, SES is in sandbox (200/24h, 1/sec, verified recipients only).

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
FROM_ADDRESS=no-reply@groundstatesociety.com
CONFIG_SET=gss-subscribe
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
- Secrets `SessionSecret` + `TokenPepper` (from Secrets Manager, generated with `openssl rand -hex 32`).

```bash
sam build
sam deploy --profile ground-state \
  --parameter-overrides \
    SessionSecret="$SESSION_SECRET" TokenPepper="$TOKEN_PEPPER" \
    ApiCertArn="$API_CERT_ARN" AlarmEmail="$ALARM_EMAIL" \
    ReservedConcurrency=-1
```

`ReservedConcurrency=-1` omits the reserved-concurrency cap — required while the account's total Lambda concurrency quota is still 10 (increase to 1000 requested). Defaults cover `FromAddress`, `ConfigSet`, `SignalVerifyUrl`, `QuantumVerifyUrl`, `ApiDomainName`.

After the first deploy, point `api.groundstatesociety.com` at the `RegionalDomainTarget` output (A/ALIAS in the 659-owned `groundstatesociety.com` zone, `Z00828413P9V0JNO3MQGW`):

```bash
aws cloudformation describe-stacks --stack-name gss-subscribe --region us-east-2 \
  --profile ground-state --query "Stacks[0].Outputs"
```
