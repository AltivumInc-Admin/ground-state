# backend/subscribe

Double opt-in email capture for The Ground State Society. A single Lambda handles two routes — `/subscribe` writes a source-tagged pending record and fires a magic-link email via SES; `/verify` consumes the token, confirms the subscriber, and mints an HttpOnly session cookie.

Deployed as the `gss-subscribe` CloudFormation stack (SAM) in `us-east-2`.

---

## Routes

### POST /subscribe

Accepts `{ "email": "...", "source": "signal" | "quantum-intro" }`.

- Validates email format and source allowlist.
- Honeypot field `website`: if filled the request is silently accepted and dropped (bot protection).
- Writes a `PENDING#<email>` item in DynamoDB with a hashed magic-link token, consent IP, and a 24-hour TTL.
- If the email is not already confirmed, sends the magic link via SES.
- Always returns `{ "ok": true }` — the response never reveals membership state.

### POST /verify

Accepts `{ "token": "..." }` (the raw token from the magic link).

- Hashes the token with `TOKEN_PEPPER` and looks it up in DynamoDB.
- Consumes (deletes) the pending token and promotes the subscriber to confirmed.
- Returns `{ "ok": true, "next": "<MODULE_URL>/learn" }` and sets an HttpOnly, SameSite=Strict session cookie valid for `SESSION_TTL_SEC` seconds.
- Returns `{ "error": "invalid_token" }` on any mismatch or expiry — no information disclosure.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `TABLE_NAME` | yes | DynamoDB table name (injected by CloudFormation). |
| `SESSION_SECRET` | yes | HMAC-SHA256 secret for signing session cookies. Rotate with a deploy; old sessions expire naturally. |
| `TOKEN_PEPPER` | yes | HMAC-SHA256 pepper mixed into magic-link token hashes before storage. Prevents token extraction from a leaked table. |
| `FROM_ADDRESS` | yes | SES-verified sender, e.g. `no-reply@altivum.ai`. Must be in the same region as the stack. |
| `CONFIG_SET` | yes | SES configuration set name (`gss-subscribe`). Routes bounce/complaint events to SNS. |
| `MODULE_URL` | yes | Base URL of the quantum learning module (`https://quantum.altivum.ai`). Used in magic-link URLs and the post-verify redirect. |
| `COOKIE_DOMAIN` | yes | Cookie `Domain` attribute (`.altivum.ai`). Lets the session cookie be read by both `groundstatesociety.com` and `quantum.altivum.ai`. |
| `SESSION_TTL_SEC` | no | Session cookie lifetime in seconds (default `2592000` = 30 days). |

Set secrets in `.env.local` for local development. Never commit them.

---

## SES setup (Phase 0 — sandbox)

SES starts in sandbox mode. Both sender and recipient addresses must be individually verified before any email is delivered outside of production access.

**Completed:**

- Domain identity `altivum.ai` verified (DKIM + DMARC).
- Sender `no-reply@altivum.ai` verified.
- Configuration set `gss-subscribe` created with bounce/complaint SNS destination.

**Production access:**

SES sandbox limits outbound to verified addresses only. A production-access request must be submitted via the AWS console (SES > Account dashboard > Request production access) before the subscriber flow can reach real users.

<!-- TODO: record the SES production-access case ID here once submitted -->
Case ID: _pending_

---

## Local development

Run the handler on port 8788 without deploying:

```bash
node --env-file=../../.env.local local.mjs
```

The harness wraps the Lambda handler in a plain HTTP server, forwards inbound cookies into `event.cookies`, and writes the handler's `cookies[]` array as `Set-Cookie` response headers. CORS is set to the caller's `Origin` (permissive for local use; the deployed stack uses `CorsConfiguration` on the HttpApi).

Minimal `.env.local` for the subscribe backend:

```
TABLE_NAME=local-dev          # not used locally unless you wire a real table
SESSION_SECRET=dev-secret-32-chars-min
TOKEN_PEPPER=dev-pepper-32-chars-min
FROM_ADDRESS=no-reply@altivum.ai
CONFIG_SET=gss-subscribe
MODULE_URL=http://localhost:5174
COOKIE_DOMAIN=localhost
```

---

## Running the test suite

From the repo root:

```bash
npm test
```

Both `backend/checkout` and `backend/subscribe` suites must pass before a deploy is allowed. The Amplify build hook runs `npm test`; a red suite blocks the deploy.

From this directory only:

```bash
node --test "test/*.test.mjs"
```

---

## Deploy

Prerequisites:

- AWS CLI configured for the `us-east-2` region.
- SAM CLI installed (`brew install aws-sam-cli`).
- A regional ACM certificate for `api.altivum.ai` in `us-east-2` (the HttpApi custom domain requires a regional cert, not a CloudFront/us-east-1 cert).
- A DNS record pointing `api.altivum.ai` to the `RegionalDomainTarget` output value (CNAME or ALIAS depending on your DNS provider). Create this after the first deploy.

```bash
sam build
sam deploy \
  --parameter-overrides \
    SessionSecret="$SESSION_SECRET" \
    TokenPepper="$TOKEN_PEPPER" \
    FromAddress="$FROM_ADDRESS" \
    ConfigSet="$CONFIG_SET" \
    ModuleUrl="$MODULE_URL" \
    CookieDomain="$COOKIE_DOMAIN" \
    ApiCertArn="$API_CERT_ARN" \
    AlarmEmail="$ALARM_EMAIL"
```

All sensitive values are read from the environment at deploy time — nothing secret is written to `samconfig.toml` or committed to the repo.

After the first deploy, retrieve the `RegionalDomainTarget` output and add the DNS record:

```bash
aws cloudformation describe-stacks \
  --stack-name gss-subscribe \
  --region us-east-2 \
  --query "Stacks[0].Outputs"
```

### api.altivum.ai regional ACM certificate

The custom domain `api.altivum.ai` requires a certificate issued in the same region as the stack (`us-east-2`). If you already have a certificate for `*.altivum.ai` or `api.altivum.ai` in `us-east-1` (for CloudFront), request a separate one in `us-east-2` — they can coexist. Pass the `us-east-2` ARN as `ApiCertArn`.
