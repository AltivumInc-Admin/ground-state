# Email Capture & Verify Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared double-opt-in email-capture backend (`POST /subscribe`, `POST /verify`) that writes a unified, source-tagged subscriber list to DynamoDB, sends magic links via SES, and mints an HttpOnly session cookie on verification — then wire the ground-state "Signal" form to it.

**Architecture:** A new dependency-free SAM stack `backend/subscribe/`, mirroring the existing `backend/checkout/` (Node 22 ESM, AWS SDK v3 from the runtime, `node:test`, zero `node_modules` to install). One Lambda serves two routes behind an API Gateway HTTP API on the custom domain `api.altivum.ai`. A single DynamoDB table holds both subscriber records (`EMAIL#…`) and short-lived single-use magic-link lookups (`TOKEN#…`). On verify it mints an HMAC-signed session in an HttpOnly cookie scoped to `.altivum.ai`.

**Tech Stack:** AWS SAM, API Gateway HTTP API (payload v2), Lambda (nodejs22.x, arm64), DynamoDB (on-demand, TTL), Amazon SES v2, Secrets Manager, CloudWatch alarms + SNS, ACM (regional, us-east-2). Frontend: the existing Vite/React `ground-state` app.

**Scope note:** This is **Plan 1 of 2**. Plan 2 (the module's content API + authorizer + `/learn` rendering refactor + gated notebooks + no-leak CI test) is authored separately in the `quantum-computing` session from Section 12 of the design spec. Plan 1 is independently shippable: it captures emails with double opt-in (D1), writes the unified tagged list (D2), and mints the session credential (D3 depends on). It does **not** require the module to exist.

> **Revision (2026-06-18):** Built, then revised for the GSS dedicated-account migration. The stack now lives in account 659 on **`api.groundstatesociety.com`** (not `api.altivum.ai`), SES sends from `@groundstatesociety.com`, and `/verify` returns a **bearer token in the body instead of an HttpOnly cookie** (the module is now cross-site). Magic links are per-source (`signal` → `/confirm`). Deployed + verified alive in 659; 25/25 tests. See the spec's Revision note.

**Design spec:** `docs/superpowers/specs/2026-06-17-quantum-module-email-gate-design.md`

## Global Constraints

- **Dependency-free Lambda:** the shipped Lambda artifact has no bundled deps. Import `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-sesv2` from the **runtime-provided SDK v3** (confirmed available in nodejs22.x). `src/package.json` = `{ "type": "module" }` with **no dependencies** (SAM `CodeUri: src/` so nothing is bundled). (AWS recommends bundling for version pinning; we accept the runtime SDK to preserve the repo's zero-deps convention — revisit only if a runtime SDK update breaks behavior.)
- **Test/build infra (amendment, post-Task-2):** those three AWS SDK v3 packages are added as **root `devDependencies`** so `node --test` and `sam build` resolve them locally. This does NOT bundle them into the Lambda (they live in the repo-root `node_modules`, outside `CodeUri: src/`); the shipped artifact stays dependency-free. The local tests import the SDK command classes (`PutCommand`, etc.) and `store.mjs`/`email.mjs` construct the SDK clients at import — both need the SDK resolvable at test time.
- **Runtime:** `nodejs22.x`, `arm64`, `MemorySize: 256`, `Timeout: 15`, `ReservedConcurrentExecutions: 10` (mirror `backend/checkout`).
- **Region:** `us-east-2` for all resources (Lambda, DynamoDB, SES, the HTTP API, and the **regional** ACM cert for `api.altivum.ai`).
- **No enumeration:** `/subscribe` returns the **same** generic `200 { ok: true }` whether or not the email already exists. Never reveal membership state.
- **Fail closed:** missing `SESSION_SECRET` or `TOKEN_PEPPER` → `503`, never a degraded-but-open path.
- **Constant-time** comparison for all token/HMAC checks (`node:crypto` `timingSafeEqual`).
- **CORS is owned by the HTTP API `CorsConfiguration`, never set in the handler** (duplicate headers break browsers — same rule as `backend/checkout`).
- **Cookie:** `session=<value>; HttpOnly; Secure; SameSite=Lax; Domain=.altivum.ai; Path=/; Max-Age=2592000` (30 days). Same registrable site as `quantum.altivum.ai`, so `SameSite=Lax` (avoids cross-site third-party-cookie blocking).
- **Token:** single-use, hashed at rest (HMAC under `TOKEN_PEPPER`), raw value never stored or logged; magic-link TTL 15 min; abandoned `pending` subscriber TTL 24 h.
- **Copy/UX (ground-state intent):** quiet, honest, no emoji, no popups/scarcity.
- **DynamoDB reserved words** `status`, `ttl`, `source` must be aliased via `ExpressionAttributeNames` in every expression.

---

### Task 0: SES provisioning (Phase 0 — the launch long-pole, no code)

**Files:** none (AWS account operations). Document outcomes in `backend/subscribe/README.md` (created in Task 8).

**Why first:** SES production access is a Support request (~24 h first response, approval not guaranteed) and gates real sending. Start it before writing code so it approves in parallel.

- [ ] **Step 1: Verify the `altivum.ai` domain identity (us-east-2) + Easy DKIM**

```bash
aws sesv2 create-email-identity --region us-east-2 --email-identity altivum.ai \
  --dkim-signing-attributes NextSigningKeyLength=RSA_2048_BIT
aws sesv2 get-email-identity --region us-east-2 --email-identity altivum.ai \
  --query '{verified:VerifiedForSendingStatus,dkim:DkimAttributes.Status,tokens:DkimAttributes.Tokens}'
```

Add the three returned CNAME DKIM tokens to `altivum.ai` DNS. Re-run `get-email-identity` until `dkim` = `SUCCESS` and `verified` = `true`.

- [ ] **Step 2: Configure a custom MAIL FROM subdomain (DMARC alignment)**

```bash
aws sesv2 put-email-identity-mail-from-attributes --region us-east-2 \
  --email-identity altivum.ai --mail-from-domain mail.altivum.ai \
  --behavior-on-mx-failure USE_DEFAULT_VALUE
```

Add the MX (`feedback-smtp.us-east-2.amazonses.com`) and SPF (`v=spf1 include:amazonses.com ~all`) records for `mail.altivum.ai` to DNS. Add a DMARC record at `_dmarc.altivum.ai` (`v=DMARC1; p=none; rua=mailto:dmarc@altivum.ai` to start).

- [ ] **Step 3: Create a configuration set with bounce/complaint event publishing**

```bash
aws sesv2 create-configuration-set --region us-east-2 --configuration-set-name gss-subscribe
aws sns create-topic --region us-east-2 --name gss-ses-events
# Subscribe an email/handler to the topic, then:
aws sesv2 create-configuration-set-event-destination --region us-east-2 \
  --configuration-set-name gss-subscribe --event-destination-name to-sns \
  --event-destination '{"Enabled":true,"MatchingEventTypes":["BOUNCE","COMPLAINT"],"SnsDestination":{"TopicArn":"<gss-ses-events-arn>"}}'
```

- [ ] **Step 4: Request production access (declare Transactional)**

In the SES console (us-east-2) → Account dashboard → **Request production access**. Mail type: **Transactional**. Describe the double-opt-in flow; confirm you only email people who requested it and handle bounces/complaints.
Expected: case opens; first response ~24 h. **Record the case ID.**

- [ ] **Step 5: Verify a sandbox test send works end-to-end (while waiting for production)**

Verify one personal address as a recipient, then:

```bash
aws sesv2 send-email --region us-east-2 \
  --from-email-address "no-reply@altivum.ai" \
  --destination 'ToAddresses=["<your-verified-test-address>"]' \
  --content '{"Simple":{"Subject":{"Data":"SES test"},"Body":{"Text":{"Data":"hello"}}}}' \
  --configuration-set-name gss-subscribe
```

Expected: a `MessageId` returned and the email arrives. This proves DKIM/identity/config-set before any Lambda is wired.

---

### Task 1: `crypto.mjs` — token + session primitives

**Files:**
- Create: `backend/subscribe/src/crypto.mjs`
- Create: `backend/subscribe/src/package.json` (`{ "type": "module" }`, no deps)
- Test: `backend/subscribe/test/crypto.test.mjs`

**Interfaces:**
- Produces:
  - `generateToken(): string` — 32-byte base64url random (URL-safe magic-link token / jti)
  - `hashToken(token: string): string` — hex HMAC-SHA256 of `token` under `process.env.TOKEN_PEPPER`
  - `signSession(payload: object): string` — `base64url(JSON(payload)) + "." + hex HMAC` under `process.env.SESSION_SECRET`
  - `verifySession(value: string): object | null` — returns the payload if the HMAC checks out (constant-time) and `payload.exp` (epoch s) is in the future, else `null`
  - `safeEqualHex(a: string, b: string): boolean` — length-checked `timingSafeEqual`

- [ ] **Step 1: Write `backend/subscribe/src/package.json`**

```json
{ "type": "module" }
```

- [ ] **Step 2: Write the failing test** — `backend/subscribe/test/crypto.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.TOKEN_PEPPER = 'pepper_test'
process.env.SESSION_SECRET = 'session_test'

const { generateToken, hashToken, signSession, verifySession, safeEqualHex } =
  await import('../src/crypto.mjs')

test('generateToken returns distinct url-safe strings', () => {
  const a = generateToken()
  const b = generateToken()
  assert.notEqual(a, b)
  assert.match(a, /^[A-Za-z0-9_-]+$/)
  assert.ok(a.length >= 40)
})

test('hashToken is deterministic and pepper-bound, never the raw token', () => {
  const t = generateToken()
  assert.equal(hashToken(t), hashToken(t))
  assert.notEqual(hashToken(t), t)
  assert.match(hashToken(t), /^[0-9a-f]{64}$/)
})

test('signSession round-trips and rejects tampering', () => {
  const value = signSession({ sub: 'abc', jti: 'j1', exp: Math.floor(Date.now() / 1000) + 60 })
  const payload = verifySession(value)
  assert.equal(payload.sub, 'abc')
  assert.equal(verifySession(value + 'x'), null)
  assert.equal(verifySession('garbage'), null)
})

test('verifySession rejects an expired session', () => {
  const value = signSession({ sub: 'abc', jti: 'j1', exp: Math.floor(Date.now() / 1000) - 1 })
  assert.equal(verifySession(value), null)
})

test('safeEqualHex compares by value, length-safe', () => {
  assert.equal(safeEqualHex('aa', 'aa'), true)
  assert.equal(safeEqualHex('aa', 'ab'), false)
  assert.equal(safeEqualHex('aa', 'aaaa'), false)
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd backend/subscribe && node --test test/crypto.test.mjs`
Expected: FAIL — `Cannot find module '../src/crypto.mjs'`.

- [ ] **Step 4: Write `backend/subscribe/src/crypto.mjs`**

```js
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const b64url = (buf) => buf.toString('base64url')

export function generateToken() {
  return b64url(randomBytes(32))
}

export function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'utf8')
  const bb = Buffer.from(String(b), 'utf8')
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export function hashToken(token) {
  const pepper = process.env.TOKEN_PEPPER
  if (!pepper) throw new Error('TOKEN_PEPPER not set')
  return createHmac('sha256', pepper).update(token, 'utf8').digest('hex')
}

export function signSession(payload) {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET not set')
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = createHmac('sha256', secret).update(body, 'utf8').digest('hex')
  return `${body}.${sig}`
}

export function verifySession(value) {
  const secret = process.env.SESSION_SECRET
  if (!secret || typeof value !== 'string') return null
  const dot = value.lastIndexOf('.')
  if (dot < 0) return null
  const body = value.slice(0, dot)
  const sig = value.slice(dot + 1)
  const expected = createHmac('sha256', secret).update(body, 'utf8').digest('hex')
  if (!safeEqualHex(sig, expected)) return null
  let payload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (typeof payload?.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null
  return payload
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd backend/subscribe && node --test test/crypto.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/subscribe/src/package.json backend/subscribe/src/crypto.mjs backend/subscribe/test/crypto.test.mjs
git commit -m "feat(subscribe): token + session crypto primitives"
```

---

### Task 2: `cookies.mjs` — build/parse the session cookie

**Files:**
- Create: `backend/subscribe/src/cookies.mjs`
- Test: `backend/subscribe/test/cookies.test.mjs`

**Interfaces:**
- Consumes: `process.env.COOKIE_DOMAIN`, `process.env.SESSION_TTL_SEC`
- Produces:
  - `buildSessionCookie(value: string): string` — full Set-Cookie string (HttpOnly; Secure; SameSite=Lax; Domain; Path=/; Max-Age)
  - `parseCookies(event): Record<string,string>` — reads payload-v2 `event.cookies` array

- [ ] **Step 1: Write the failing test** — `backend/subscribe/test/cookies.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.COOKIE_DOMAIN = '.altivum.ai'
process.env.SESSION_TTL_SEC = '2592000'

const { buildSessionCookie, parseCookies } = await import('../src/cookies.mjs')

test('buildSessionCookie sets the security attributes', () => {
  const c = buildSessionCookie('abc.def')
  assert.match(c, /^session=abc\.def;/)
  assert.match(c, /HttpOnly/)
  assert.match(c, /Secure/)
  assert.match(c, /SameSite=Lax/)
  assert.match(c, /Domain=\.altivum\.ai/)
  assert.match(c, /Path=\//)
  assert.match(c, /Max-Age=2592000/)
})

test('parseCookies reads the payload-v2 cookies array', () => {
  assert.deepEqual(parseCookies({ cookies: ['session=abc', 'theme=dark'] }), {
    session: 'abc',
    theme: 'dark',
  })
  assert.deepEqual(parseCookies({}), {})
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend/subscribe && node --test test/cookies.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `backend/subscribe/src/cookies.mjs`**

```js
export function buildSessionCookie(value) {
  const domain = process.env.COOKIE_DOMAIN || '.altivum.ai'
  const maxAge = process.env.SESSION_TTL_SEC || '2592000'
  return `session=${value}; HttpOnly; Secure; SameSite=Lax; Domain=${domain}; Path=/; Max-Age=${maxAge}`
}

export function parseCookies(event) {
  const out = {}
  for (const c of event?.cookies ?? []) {
    const i = c.indexOf('=')
    if (i > 0) out[c.slice(0, i)] = c.slice(i + 1)
  }
  return out
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd backend/subscribe && node --test test/cookies.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/subscribe/src/cookies.mjs backend/subscribe/test/cookies.test.mjs
git commit -m "feat(subscribe): session cookie build/parse helpers"
```

---

### Task 3: `store.mjs` — DynamoDB subscriber + token operations

**Files:**
- Create: `backend/subscribe/src/store.mjs`
- Test: `backend/subscribe/test/store.test.mjs`

**Interfaces:**
- Consumes: `process.env.TABLE_NAME`, runtime SDK v3 (`@aws-sdk/lib-dynamodb`)
- Produces (all async):
  - `createPending({ email, source, tokenHash, consentIp }): Promise<{ alreadyConfirmed: boolean }>` — upsert `EMAIL#email` to `pending` (idempotent; never downgrades a `confirmed` record), and write a single-use `TOKEN#tokenHash → { email }` with a 15-min TTL. If the email is already `confirmed`, skips the token and returns `{ alreadyConfirmed: true }`.
  - `consumeToken(tokenHash): Promise<{ email: string } | null>` — atomically delete `TOKEN#tokenHash` (single-use) and return its email; `null` if missing or expired.
  - `confirm(email): Promise<boolean>` — flip `EMAIL#email` `pending → confirmed`, set `confirmedAt`, `REMOVE ttl`; `true` if it transitioned (or was already confirmed), `false` if no such record.
  - exported client `ddb` (so tests can stub `ddb.send`); constants `EMAIL_TTL_SEC = 86400`, `TOKEN_TTL_SEC = 900`.

- [ ] **Step 1: Write the failing test** — `backend/subscribe/test/store.test.mjs`

```js
import { test, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'

process.env.TABLE_NAME = 'Subscribers-test'

const { ddb, createPending, consumeToken, confirm } = await import('../src/store.mjs')

class ConditionalCheckFailedException extends Error {
  constructor() { super('conditional'); this.name = 'ConditionalCheckFailedException' }
}

beforeEach(() => mock.restoreAll())

test('createPending writes EMAIL# (create) then TOKEN#', async () => {
  const sent = []
  mock.method(ddb, 'send', async (cmd) => { sent.push(cmd); return {} })
  const res = await createPending({ email: 'a@b.co', source: 'signal', tokenHash: 'h1', consentIp: '1.2.3.4' })
  assert.deepEqual(res, { alreadyConfirmed: false })
  assert.equal(sent.length, 2)
  assert.ok(sent[0] instanceof PutCommand)
  assert.equal(sent[0].input.Item.PK, 'EMAIL#a@b.co')
  assert.equal(sent[0].input.Item.status, 'pending')
  assert.equal(sent[0].input.Item.source, 'signal')
  assert.ok(sent[1] instanceof PutCommand)
  assert.equal(sent[1].input.Item.PK, 'TOKEN#h1')
  assert.equal(sent[1].input.Item.email, 'a@b.co')
})

test('createPending on an already-confirmed email skips the token', async () => {
  let call = 0
  mock.method(ddb, 'send', async () => {
    call += 1
    if (call === 1) throw new ConditionalCheckFailedException() // EMAIL# create blocked (exists)
    if (call === 2) throw new ConditionalCheckFailedException() // refresh blocked (already confirmed)
    return {}
  })
  const res = await createPending({ email: 'a@b.co', source: 'signal', tokenHash: 'h1', consentIp: '1.2.3.4' })
  assert.deepEqual(res, { alreadyConfirmed: true })
  assert.equal(call, 2) // never wrote a TOKEN# item
})

test('consumeToken deletes and returns the email', async () => {
  mock.method(ddb, 'send', async (cmd) => {
    assert.ok(cmd instanceof DeleteCommand)
    return { Attributes: { email: 'a@b.co', ttl: Math.floor(Date.now() / 1000) + 100 } }
  })
  assert.deepEqual(await consumeToken('h1'), { email: 'a@b.co' })
})

test('consumeToken returns null when the token is gone', async () => {
  mock.method(ddb, 'send', async () => { throw new ConditionalCheckFailedException() })
  assert.equal(await consumeToken('h1'), null)
})

test('consumeToken returns null when the token is expired', async () => {
  mock.method(ddb, 'send', async () => ({
    Attributes: { email: 'a@b.co', ttl: Math.floor(Date.now() / 1000) - 1 },
  }))
  assert.equal(await consumeToken('h1'), null)
})

test('confirm transitions pending and is true', async () => {
  mock.method(ddb, 'send', async (cmd) => {
    assert.ok(cmd instanceof UpdateCommand)
    return { Attributes: { status: 'confirmed' } }
  })
  assert.equal(await confirm('a@b.co'), true)
})

test('confirm returns false when no pending record exists', async () => {
  mock.method(ddb, 'send', async () => { throw new ConditionalCheckFailedException() })
  assert.equal(await confirm('a@b.co'), false)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend/subscribe && node --test test/store.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `backend/subscribe/src/store.mjs`**

```js
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))
export const EMAIL_TTL_SEC = 86400 // abandoned pending subscriber expiry (24h)
export const TOKEN_TTL_SEC = 900 // magic-link single-use lifetime (15 min)

const TABLE = () => process.env.TABLE_NAME
const nowSec = () => Math.floor(Date.now() / 1000)
const isConditional = (e) => e?.name === 'ConditionalCheckFailedException'

export async function createPending({ email, source, tokenHash, consentIp }) {
  const now = nowSec()
  let alreadyConfirmed = false
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE(),
        Item: {
          PK: `EMAIL#${email}`,
          status: 'pending',
          source,
          consentIp,
          consentAt: now,
          ttl: now + EMAIL_TTL_SEC,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    )
  } catch (e) {
    if (!isConditional(e)) throw e
    // Record exists: refresh to pending ONLY if not already confirmed.
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE(),
          Key: { PK: `EMAIL#${email}` },
          UpdateExpression: 'SET #s = :pending, consentAt = :now, #ttl = :exp',
          ConditionExpression: '#s <> :confirmed',
          ExpressionAttributeNames: { '#s': 'status', '#ttl': 'ttl' },
          ExpressionAttributeValues: {
            ':pending': 'pending',
            ':confirmed': 'confirmed',
            ':now': now,
            ':exp': now + EMAIL_TTL_SEC,
          },
        }),
      )
    } catch (e2) {
      if (!isConditional(e2)) throw e2
      alreadyConfirmed = true
    }
  }

  if (!alreadyConfirmed) {
    await ddb.send(
      new PutCommand({
        TableName: TABLE(),
        Item: { PK: `TOKEN#${tokenHash}`, email, ttl: now + TOKEN_TTL_SEC },
      }),
    )
  }
  return { alreadyConfirmed }
}

export async function consumeToken(tokenHash) {
  let res
  try {
    res = await ddb.send(
      new DeleteCommand({
        TableName: TABLE(),
        Key: { PK: `TOKEN#${tokenHash}` },
        ConditionExpression: 'attribute_exists(PK)',
        ReturnValues: 'ALL_OLD',
      }),
    )
  } catch (e) {
    if (isConditional(e)) return null // already consumed / never existed
    throw e
  }
  const item = res.Attributes
  if (!item) return null
  // TTL deletion is best-effort — reject an expired-but-not-yet-swept token.
  if (typeof item.ttl === 'number' && item.ttl <= nowSec()) return null
  return { email: item.email }
}

export async function confirm(email) {
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE(),
        Key: { PK: `EMAIL#${email}` },
        UpdateExpression: 'SET #s = :confirmed, confirmedAt = :now REMOVE #ttl',
        ConditionExpression: 'attribute_exists(PK) AND #s = :pending',
        ExpressionAttributeNames: { '#s': 'status', '#ttl': 'ttl' },
        ExpressionAttributeValues: {
          ':confirmed': 'confirmed',
          ':pending': 'pending',
          ':now': nowSec(),
        },
      }),
    )
    return true
  } catch (e) {
    if (!isConditional(e)) throw e
    // Either no record, or already confirmed. Re-check: treat already-confirmed as success.
    return await isConfirmed(email)
  }
}

async function isConfirmed(email) {
  const { GetCommand } = await import('@aws-sdk/lib-dynamodb')
  const res = await ddb.send(
    new GetCommand({ TableName: TABLE(), Key: { PK: `EMAIL#${email}` } }),
  )
  return res.Item?.status === 'confirmed'
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd backend/subscribe && node --test test/store.test.mjs`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/subscribe/src/store.mjs backend/subscribe/test/store.test.mjs
git commit -m "feat(subscribe): DynamoDB subscriber + single-use token store"
```

---

### Task 4: `email.mjs` — send the magic link via SES v2

**Files:**
- Create: `backend/subscribe/src/email.mjs`
- Test: `backend/subscribe/test/email.test.mjs`

**Interfaces:**
- Consumes: `process.env.FROM_ADDRESS`, `process.env.CONFIG_SET`, runtime SDK v3 (`@aws-sdk/client-sesv2`)
- Produces: `sendMagicLink({ to: string, link: string }): Promise<void>`; exported client `ses` (tests stub `ses.send`).

- [ ] **Step 1: Write the failing test** — `backend/subscribe/test/email.test.mjs`

```js
import { test, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { SendEmailCommand } from '@aws-sdk/client-sesv2'

process.env.FROM_ADDRESS = 'no-reply@altivum.ai'
process.env.CONFIG_SET = 'gss-subscribe'

const { ses, sendMagicLink } = await import('../src/email.mjs')

beforeEach(() => mock.restoreAll())

test('sendMagicLink issues a SES v2 SendEmail with html+text and the config set', async () => {
  let cmd
  mock.method(ses, 'send', async (c) => { cmd = c; return { MessageId: 'm1' } })
  await sendMagicLink({ to: 'a@b.co', link: 'https://quantum.altivum.ai/verify?token=XYZ' })
  assert.ok(cmd instanceof SendEmailCommand)
  const i = cmd.input
  assert.equal(i.FromEmailAddress, 'no-reply@altivum.ai')
  assert.deepEqual(i.Destination.ToAddresses, ['a@b.co'])
  assert.equal(i.ConfigurationSetName, 'gss-subscribe')
  assert.match(i.Content.Simple.Body.Html.Data, /quantum\.altivum\.ai\/verify\?token=XYZ/)
  assert.match(i.Content.Simple.Body.Text.Data, /quantum\.altivum\.ai\/verify\?token=XYZ/)
  assert.doesNotMatch(i.Content.Simple.Subject.Data, /[\u{1F300}-\u{1FAFF}]/u) // no emoji
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend/subscribe && node --test test/email.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `backend/subscribe/src/email.mjs`**

```js
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'

export const ses = new SESv2Client({})

export async function sendMagicLink({ to, link }) {
  const subject = 'Confirm your free access to the Quantum Intro'
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1a1a1a">
    <p>Confirm your email to open the free Introduction to Quantum Computing.</p>
    <p><a href="${link}">Confirm and start learning</a></p>
    <p style="color:#666;font-size:14px">This link expires in 15 minutes. If you didn't request it, ignore this email.</p>
  </body></html>`
  const text = `Confirm your email to open the free Introduction to Quantum Computing.\n\n${link}\n\nThis link expires in 15 minutes. If you didn't request it, ignore this email.`

  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: process.env.FROM_ADDRESS,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: html, Charset: 'UTF-8' },
            Text: { Data: text, Charset: 'UTF-8' },
          },
        },
      },
      ...(process.env.CONFIG_SET && { ConfigurationSetName: process.env.CONFIG_SET }),
    }),
  )
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd backend/subscribe && node --test test/email.test.mjs`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add backend/subscribe/src/email.mjs backend/subscribe/test/email.test.mjs
git commit -m "feat(subscribe): SES v2 magic-link email"
```

---

### Task 5: `handler.mjs` — `POST /subscribe` route

**Files:**
- Create: `backend/subscribe/src/handler.mjs`
- Test: `backend/subscribe/test/handler.test.mjs`

**Interfaces:**
- Consumes: `crypto.mjs`, `store.mjs`, `email.mjs`, `cookies.mjs`; env `MODULE_URL`, `SESSION_SECRET`, `TOKEN_PEPPER`.
- Produces: `handler(event)` routing `POST /subscribe` and `POST /verify`. `/subscribe` always returns generic `200 { ok: true }` (no enumeration); honeypot filled → silent `200`; invalid email/source → `400`.

For tests, inject the side-effecting modules. Add a `makeHandler(deps)` factory; the default `handler` wires the real modules.

- [ ] **Step 1: Write the failing test** — `backend/subscribe/test/handler.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.MODULE_URL = 'https://quantum.altivum.ai'
process.env.TOKEN_PEPPER = 'pepper_test'
process.env.SESSION_SECRET = 'session_test'
process.env.COOKIE_DOMAIN = '.altivum.ai'
process.env.SESSION_TTL_SEC = '2592000'

const { makeHandler } = await import('../src/handler.mjs')

const event = ({ method = 'POST', path = '/subscribe', body, headers = {} } = {}) => ({
  rawPath: path,
  requestContext: { http: { method, sourceIp: '9.9.9.9' } },
  headers,
  body: typeof body === 'string' || body === undefined ? body : JSON.stringify(body),
})

function fakes() {
  const calls = { created: [], sent: [], consumed: [], confirmed: [] }
  const store = {
    async createPending(a) { calls.created.push(a); return { alreadyConfirmed: false } },
    async consumeToken(h) { calls.consumed.push(h); return { email: 'a@b.co' } },
    async confirm(e) { calls.confirmed.push(e); return true },
  }
  const email = { async sendMagicLink(a) { calls.sent.push(a) } }
  return { handler: makeHandler({ store, email }), calls }
}

test('valid subscribe stores pending and sends a link, generic 200', async () => {
  const { handler, calls } = fakes()
  const res = await handler(event({ body: { email: 'a@b.co', source: 'signal' } }))
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { ok: true })
  assert.equal(calls.created.length, 1)
  assert.equal(calls.created[0].source, 'signal')
  assert.equal(calls.created[0].consentIp, '9.9.9.9')
  assert.equal(calls.sent.length, 1)
  assert.match(calls.sent[0].link, /\/verify\?token=/)
})

test('honeypot filled returns 200 but stores/sends nothing', async () => {
  const { handler, calls } = fakes()
  const res = await handler(event({ body: { email: 'a@b.co', source: 'signal', website: 'spam' } }))
  assert.equal(res.statusCode, 200)
  assert.equal(calls.created.length, 0)
  assert.equal(calls.sent.length, 0)
})

test('invalid email returns 400', async () => {
  const { handler } = fakes()
  const res = await handler(event({ body: { email: 'nope', source: 'signal' } }))
  assert.equal(res.statusCode, 400)
})

test('invalid source returns 400', async () => {
  const { handler } = fakes()
  const res = await handler(event({ body: { email: 'a@b.co', source: 'evil' } }))
  assert.equal(res.statusCode, 400)
})

test('already-confirmed email still returns generic 200 without sending', async () => {
  const { calls } = fakes()
  const store = {
    async createPending() { return { alreadyConfirmed: true } },
    async consumeToken() {}, async confirm() {},
  }
  const handler = makeHandler({ store, email: { async sendMagicLink(a) { calls.sent.push(a) } } })
  const res = await handler(event({ body: { email: 'a@b.co', source: 'signal' } }))
  assert.equal(res.statusCode, 200)
  assert.equal(calls.sent.length, 0)
})

test('unknown route returns 404', async () => {
  const { handler } = fakes()
  assert.equal((await handler(event({ path: '/nope' }))).statusCode, 404)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend/subscribe && node --test test/handler.test.mjs`
Expected: FAIL — `makeHandler` not exported.

- [ ] **Step 3: Write `backend/subscribe/src/handler.mjs` (subscribe route only for now)**

```js
import { generateToken, hashToken } from './crypto.mjs'
import * as defaultStore from './store.mjs'
import * as defaultEmail from './email.mjs'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SOURCES = new Set(['signal', 'quantum-intro'])

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

const clientIp = (event) => event.requestContext?.http?.sourceIp ?? 'unknown'

export function makeHandler({ store = defaultStore, email = defaultEmail } = {}) {
  async function subscribe(event) {
    let body
    try {
      body = JSON.parse(event.body || '')
    } catch {
      return json(400, { error: 'invalid_json' })
    }
    // Honeypot: a filled `website` field is a bot. Look successful, do nothing.
    if (typeof body?.website === 'string' && body.website.trim() !== '') {
      return json(200, { ok: true })
    }
    const emailAddr = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!emailAddr || emailAddr.length > 320 || !EMAIL_RE.test(emailAddr)) {
      return json(400, { error: 'invalid_email' })
    }
    const source = body?.source
    if (!SOURCES.has(source)) return json(400, { error: 'invalid_source' })

    const token = generateToken()
    const { alreadyConfirmed } = await store.createPending({
      email: emailAddr,
      source,
      tokenHash: hashToken(token),
      consentIp: clientIp(event),
    })
    if (!alreadyConfirmed) {
      const link = `${process.env.MODULE_URL}/verify?token=${token}`
      await email.sendMagicLink({ to: emailAddr, link })
    }
    // Generic response either way — never reveal membership state.
    return json(200, { ok: true })
  }

  return async function handler(event) {
    const method = event.requestContext?.http?.method
    const path = event.rawPath
    try {
      if (method === 'POST' && path === '/subscribe') return await subscribe(event)
      return json(404, { error: 'not_found' })
    } catch (err) {
      console.error(JSON.stringify({ at: 'unhandled', route: path, message: err?.message }))
      return json(502, { error: 'upstream_error' })
    }
  }
}

export const handler = makeHandler()
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `cd backend/subscribe && node --test test/handler.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/subscribe/src/handler.mjs backend/subscribe/test/handler.test.mjs
git commit -m "feat(subscribe): /subscribe route — validate, honeypot, store, send link"
```

---

### Task 6: `handler.mjs` — `POST /verify` route (mint session cookie)

**Files:**
- Modify: `backend/subscribe/src/handler.mjs`
- Modify: `backend/subscribe/test/handler.test.mjs`

**Interfaces:**
- Consumes: `crypto.signSession/generateToken`, `store.consumeToken/confirm`, `cookies.buildSessionCookie`; env `SESSION_TTL_SEC`, `MODULE_URL`.
- Produces: `POST /verify` body `{ token }`. On success: `200` with a top-level `cookies: [sessionCookie]` and body `{ ok: true, next: "<MODULE_URL>/learn" }`. On bad/expired/used token: `400 { error: 'invalid_token' }`.

- [ ] **Step 1: Add failing tests to `test/handler.test.mjs`**

```js
test('verify consumes the token, confirms, and sets the session cookie', async () => {
  const { handler } = fakes()
  const res = await handler(event({ path: '/verify', body: { token: 'XYZ' } }))
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).next, 'https://quantum.altivum.ai/learn')
  assert.equal(res.cookies.length, 1)
  assert.match(res.cookies[0], /^session=.+\..+;/)
  assert.match(res.cookies[0], /HttpOnly/)
  assert.match(res.cookies[0], /SameSite=Lax/)
})

test('verify with a dead token returns 400 and no cookie', async () => {
  const store = {
    async createPending() { return { alreadyConfirmed: false } },
    async consumeToken() { return null },
    async confirm() { return false },
  }
  const handler = makeHandler({ store, email: { async sendMagicLink() {} } })
  const res = await handler(event({ path: '/verify', body: { token: 'dead' } }))
  assert.equal(res.statusCode, 400)
  assert.equal(res.cookies, undefined)
})

test('verify missing token returns 400', async () => {
  const { handler } = fakes()
  assert.equal((await handler(event({ path: '/verify', body: {} }))).statusCode, 400)
})
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `cd backend/subscribe && node --test test/handler.test.mjs`
Expected: FAIL — `/verify` returns 404.

- [ ] **Step 3: Update `src/handler.mjs`** — add imports, the `verify` route, and wire it in `handler`

Add to the imports at the top:

```js
import { generateToken, hashToken, signSession } from './crypto.mjs'
import { buildSessionCookie } from './cookies.mjs'
```

Add inside `makeHandler`, after `subscribe`:

```js
  async function verify(event) {
    let body
    try {
      body = JSON.parse(event.body || '')
    } catch {
      return json(400, { error: 'invalid_json' })
    }
    const token = typeof body?.token === 'string' ? body.token : ''
    if (!token || token.length > 256) return json(400, { error: 'invalid_token' })

    const found = await store.consumeToken(hashToken(token))
    if (!found) return json(400, { error: 'invalid_token' })

    const ok = await store.confirm(found.email)
    if (!ok) return json(400, { error: 'invalid_token' })

    const ttl = Number(process.env.SESSION_TTL_SEC || '2592000')
    const session = signSession({
      jti: generateToken(),
      exp: Math.floor(Date.now() / 1000) + ttl,
    })
    return {
      statusCode: 200,
      cookies: [buildSessionCookie(session)],
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, next: `${process.env.MODULE_URL}/learn` }),
    }
  }
```

Change the route block in the returned `handler` to add verify:

```js
      if (method === 'POST' && path === '/subscribe') return await subscribe(event)
      if (method === 'POST' && path === '/verify') return await verify(event)
      return json(404, { error: 'not_found' })
```

> Note: the `import { generateToken, hashToken } from './crypto.mjs'` line from Task 5 is replaced by the combined import above (adds `signSession`). Ensure only one crypto import line remains.

- [ ] **Step 4: Run the full suite and confirm it passes**

Run: `cd backend/subscribe && node --test "test/*.test.mjs"`
Expected: PASS (all tasks' tests green).

- [ ] **Step 5: Commit**

```bash
git add backend/subscribe/src/handler.mjs backend/subscribe/test/handler.test.mjs
git commit -m "feat(subscribe): /verify route — consume token, confirm, mint session cookie"
```

---

### Task 7: SAM template, custom domain, and `samconfig.toml`

**Files:**
- Create: `backend/subscribe/template.yaml`
- Create: `backend/subscribe/samconfig.toml`

**Interfaces:**
- Produces: a deployable stack `gss-subscribe` with the `Subscribers` table, the HTTP API (CORS for both origins + credentials), the Lambda with least-privilege IAM, alarms, and the `api.altivum.ai` custom-domain mapping. Output `ApiUrl` (the custom domain).

**Prerequisite:** a regional ACM certificate for `api.altivum.ai` in **us-east-2** (created/validated separately; pass its ARN as `ApiCertArn`). After deploy, add the DNS record mapping `api.altivum.ai` → the API Gateway domain's regional target.

- [ ] **Step 1: Write `backend/subscribe/template.yaml`**

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: >
  Shared double-opt-in email capture for The Ground State Society — /subscribe
  writes a source-tagged pending subscriber and sends a magic link; /verify
  confirms and mints an HttpOnly session cookie. Unified list across the
  landing site and the quantum learning module.

Parameters:
  SessionSecret:
    Type: String
    NoEcho: true
    Description: HMAC secret for signing session cookies (from Secrets Manager).
  TokenPepper:
    Type: String
    NoEcho: true
    Description: HMAC pepper for hashing magic-link tokens at rest.
  FromAddress:
    Type: String
    Default: no-reply@altivum.ai
    Description: Verified SES sender address.
  ConfigSet:
    Type: String
    Default: gss-subscribe
    Description: SES configuration set (bounce/complaint publishing).
  ModuleUrl:
    Type: String
    Default: https://quantum.altivum.ai
    Description: Origin the magic link and post-verify redirect point at.
  CookieDomain:
    Type: String
    Default: .altivum.ai
  SessionTtlSec:
    Type: String
    Default: '2592000'
  ApiDomainName:
    Type: String
    Default: api.altivum.ai
  ApiCertArn:
    Type: String
    Description: Regional ACM cert ARN for ApiDomainName (us-east-2).
  AlarmEmail:
    Type: String
    Default: ''

Conditions:
  HasAlarmEmail: !Not [!Equals [!Ref AlarmEmail, '']]

Resources:
  SubscribersTable:
    Type: AWS::DynamoDB::Table
    Properties:
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: PK
          AttributeType: S
      KeySchema:
        - AttributeName: PK
          KeyType: HASH
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true

  SubscribeApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      DefaultRouteSettings:
        ThrottlingRateLimit: 10
        ThrottlingBurstLimit: 20
      CorsConfiguration:
        # Explicit allowlist — never '*' (incompatible with AllowCredentials).
        AllowOrigins:
          - https://groundstatesociety.com
          - https://www.groundstatesociety.com
          - https://quantum.altivum.ai
        AllowMethods: [POST, OPTIONS]
        AllowHeaders: [content-type]
        AllowCredentials: true
        MaxAge: 600

  SubscribeFunction:
    Type: AWS::Serverless::Function
    Properties:
      Runtime: nodejs22.x
      Handler: handler.handler
      CodeUri: src/
      Architectures: [arm64]
      MemorySize: 256
      Timeout: 15
      ReservedConcurrentExecutions: 10
      Environment:
        Variables:
          TABLE_NAME: !Ref SubscribersTable
          SESSION_SECRET: !Ref SessionSecret
          TOKEN_PEPPER: !Ref TokenPepper
          FROM_ADDRESS: !Ref FromAddress
          CONFIG_SET: !Ref ConfigSet
          MODULE_URL: !Ref ModuleUrl
          COOKIE_DOMAIN: !Ref CookieDomain
          SESSION_TTL_SEC: !Ref SessionTtlSec
      Policies:
        - Statement:
            - Effect: Allow
              Action: [dynamodb:PutItem, dynamodb:UpdateItem, dynamodb:DeleteItem, dynamodb:GetItem]
              Resource: !GetAtt SubscribersTable.Arn
            - Effect: Allow
              Action: ses:SendEmail
              Resource:
                - !Sub arn:aws:ses:${AWS::Region}:${AWS::AccountId}:identity/altivum.ai
                - !Sub arn:aws:ses:${AWS::Region}:${AWS::AccountId}:configuration-set/${ConfigSet}
      Events:
        Subscribe:
          Type: HttpApi
          Properties: { ApiId: !Ref SubscribeApi, Path: /subscribe, Method: POST }
        Verify:
          Type: HttpApi
          Properties: { ApiId: !Ref SubscribeApi, Path: /verify, Method: POST }

  SubscribeLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub /aws/lambda/${SubscribeFunction}
      RetentionInDays: 365

  ApiDomain:
    Type: AWS::ApiGatewayV2::DomainName
    Properties:
      DomainName: !Ref ApiDomainName
      DomainNameConfigurations:
        - CertificateArn: !Ref ApiCertArn
          EndpointType: REGIONAL

  ApiMapping:
    Type: AWS::ApiGatewayV2::ApiMapping
    Properties:
      DomainName: !Ref ApiDomain
      ApiId: !Ref SubscribeApi
      Stage: $default

  SubscribeFailureMetricFilter:
    Type: AWS::Logs::MetricFilter
    Properties:
      LogGroupName: !Ref SubscribeLogGroup
      FilterPattern: '?"\"at\":\"unhandled\""'
      MetricTransformations:
        - MetricNamespace: GSS/Subscribe
          MetricName: SubscribeFailures
          MetricValue: '1'
          DefaultValue: 0

  AlarmTopic:
    Type: AWS::SNS::Topic
    Condition: HasAlarmEmail
    Properties:
      Subscription:
        - Endpoint: !Ref AlarmEmail
          Protocol: email

  SubscribeFailureAlarm:
    Type: AWS::CloudWatch::Alarm
    Condition: HasAlarmEmail
    Properties:
      AlarmDescription: Subscribe backend logged an unhandled error.
      Namespace: GSS/Subscribe
      MetricName: SubscribeFailures
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 1
      Threshold: 0
      ComparisonOperator: GreaterThanThreshold
      TreatMissingData: notBreaching
      AlarmActions: [!Ref AlarmTopic]

  SubscribeCrashAlarm:
    Type: AWS::CloudWatch::Alarm
    Condition: HasAlarmEmail
    Properties:
      AlarmDescription: Subscribe Lambda crashed or timed out.
      Namespace: AWS/Lambda
      MetricName: Errors
      Dimensions:
        - Name: FunctionName
          Value: !Ref SubscribeFunction
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 1
      Threshold: 0
      ComparisonOperator: GreaterThanThreshold
      TreatMissingData: notBreaching
      AlarmActions: [!Ref AlarmTopic]

Outputs:
  ApiUrl:
    Description: Custom-domain base URL (set as VITE_SIGNAL_ENDPOINT base + the module's NEXT_PUBLIC_SUBSCRIBE_URL)
    Value: !Sub https://${ApiDomainName}
  RegionalDomainTarget:
    Description: Point api.altivum.ai DNS (CNAME/ALIAS) at this target
    Value: !GetAtt ApiDomain.RegionalDomainName
```

- [ ] **Step 2: Write `backend/subscribe/samconfig.toml`** (secrets come from the environment at deploy, never committed)

```toml
version = 0.1
[default.deploy.parameters]
stack_name = "gss-subscribe"
region = "us-east-2"
capabilities = "CAPABILITY_IAM"
resolve_s3 = true
```

- [ ] **Step 3: Validate and build**

Run: `cd backend/subscribe && sam validate --lint && sam build`
Expected: "template is valid" and a successful build (no `npm install` — zero deps).

- [ ] **Step 4: Commit**

```bash
git add backend/subscribe/template.yaml backend/subscribe/samconfig.toml
git commit -m "feat(subscribe): SAM stack — table, HTTP API, custom domain, IAM, alarms"
```

---

### Task 8: Local harness + README

**Files:**
- Create: `backend/subscribe/local.mjs`
- Create: `backend/subscribe/README.md`
- Modify: root `package.json` (extend the `test` script to include the new suite)

**Interfaces:**
- Produces: `node --env-file=../../.env.local local.mjs` serving the handler on `:8788` for browser testing without deploy (mirrors `backend/checkout/local.mjs`).

- [ ] **Step 1: Write `backend/subscribe/local.mjs`**

```js
import { createServer } from 'node:http'
import { handler } from './src/handler.mjs'

const PORT = 8788

createServer(async (req, res) => {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const event = {
    rawPath: url.pathname,
    requestContext: { http: { method: req.method, sourceIp: '127.0.0.1' } },
    headers: req.headers,
    cookies: (req.headers.cookie ?? '').split('; ').filter(Boolean),
    body: Buffer.concat(chunks).toString('utf8') || undefined,
  }
  const result = await handler(event)
  // Local CORS for the Vite dev origin (the deployed API uses CorsConfiguration).
  res.setHeader('access-control-allow-origin', req.headers.origin ?? '*')
  res.setHeader('access-control-allow-credentials', 'true')
  for (const c of result.cookies ?? []) res.appendHeader('set-cookie', c)
  res.writeHead(result.statusCode, result.headers)
  res.end(result.body)
}).listen(PORT, () => console.log(`subscribe handler on http://localhost:${PORT}`))
```

- [ ] **Step 2: Update root `package.json` test script**

Change the `test` script so both backend suites gate the deploy:

```json
"test": "node --test \"backend/checkout/test/*.test.mjs\" \"backend/subscribe/test/*.test.mjs\""
```

- [ ] **Step 3: Write `backend/subscribe/README.md`**

Document: the two routes; the env vars (`TABLE_NAME`, `SESSION_SECRET`, `TOKEN_PEPPER`, `FROM_ADDRESS`, `CONFIG_SET`, `MODULE_URL`, `COOKIE_DOMAIN`, `SESSION_TTL_SEC`); the SES Phase-0 outcomes + the production-access case ID; the deploy command with secrets from the environment; and the `api.altivum.ai` cert/DNS prerequisite. Mirror `backend/checkout/README` tone.

- [ ] **Step 4: Run the full suite from the repo root**

Run: `npm test`
Expected: both `checkout` and `subscribe` suites PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/subscribe/local.mjs backend/subscribe/README.md package.json
git commit -m "feat(subscribe): local harness, README, gate the deploy on the new suite"
```

---

### Task 9: Wire the ground-state "Signal" form to `/subscribe`

**Files:**
- Modify: `src/sections/FinalCta.jsx` (the `SignalForm`, around lines 60-147)
- Modify: `.env.example`
- Modify: `README.md` (the Form intake section)

**Interfaces:**
- Consumes: the deployed `ApiUrl` → `VITE_SIGNAL_ENDPOINT = https://api.altivum.ai/subscribe`.
- Produces: a credential-less capture POST `{ form: 'signal', email, source: 'signal', website }` with a hidden honeypot, and double-opt-in success copy.

- [ ] **Step 1: Add the honeypot field and `source` to the form**

In `src/sections/FinalCta.jsx`, inside the `<form className="signal-form">`, add a visually-hidden, non-tabbable honeypot input bound to new state (`const [website, setWebsite] = useState('')`), placed before the email input:

```jsx
{/* Honeypot — real users never fill this; bots do. Hidden from AT + tab order. */}
<input
  type="text"
  name="website"
  tabIndex={-1}
  autoComplete="off"
  aria-hidden="true"
  value={website}
  onChange={(e) => setWebsite(e.target.value)}
  style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}
/>
```

- [ ] **Step 2: Update the submit to send `source` + honeypot**

Change the `postJson` call (currently `postJson(SIGNAL_ENDPOINT, { form: 'signal', email })`) to:

```js
await postJson(SIGNAL_ENDPOINT, { form: 'signal', email, source: 'signal', website })
```

- [ ] **Step 3: Update the success copy to double opt-in**

Change the `status === 'sent'` message so it reflects the magic link instead of "You're in":

```jsx
{status === 'sent' && (
  <p className="signal-success">
    <strong>Check your inbox.</strong> Confirm your email and your free access opens right up.
  </p>
)}
```

- [ ] **Step 4: Update `.env.example` and `README.md`**

In `.env.example`, document `VITE_SIGNAL_ENDPOINT=` → "the gss-subscribe stack's ApiUrl + /subscribe". In `README.md` Form intake section, note the unified, source-tagged list and that the quantum module is the deliverable of the free Signal tier. Update the `VITE_SIGNAL_ENDPOINT` payload row to include `source` and the honeypot.

- [ ] **Step 5: Build to confirm no breakage**

Run: `npm run build`
Expected: build succeeds (the form still renders the inert preview when `VITE_SIGNAL_ENDPOINT` is unset).

- [ ] **Step 6: Commit**

```bash
git add src/sections/FinalCta.jsx .env.example README.md
git commit -m "feat: wire the Signal form to the unified capture endpoint (source tag, honeypot, double opt-in copy)"
```

---

### Task 10: Deploy + live end-to-end verification (the "run the real thing" gate)

**Files:** none (operational). No success claim until this passes.

- [ ] **Step 1: Create the secrets**

```bash
aws secretsmanager create-secret --region us-east-2 --name gss/subscribe/session-secret \
  --secret-string "$(openssl rand -hex 32)"
aws secretsmanager create-secret --region us-east-2 --name gss/subscribe/token-pepper \
  --secret-string "$(openssl rand -hex 32)"
```

- [ ] **Step 2: Deploy the stack** (secrets passed from the environment, never from samconfig)

```bash
cd backend/subscribe && sam build && sam deploy \
  --parameter-overrides \
    "SessionSecret=$(aws secretsmanager get-secret-value --region us-east-2 --secret-id gss/subscribe/session-secret --query SecretString --output text)" \
    "TokenPepper=$(aws secretsmanager get-secret-value --region us-east-2 --secret-id gss/subscribe/token-pepper --query SecretString --output text)" \
    "ApiCertArn=<regional-acm-cert-arn>" \
    "AlarmEmail=christian.perez@altivum.io"
```

Expected: stack `CREATE_COMPLETE`; note the `ApiUrl` and `RegionalDomainTarget` outputs. Confirm the SNS subscription email. Add the `api.altivum.ai` DNS record → `RegionalDomainTarget`.

- [ ] **Step 2b: Confirm the runtime SDK resolves (the one uncertain point from doc-check)**

Tail the function logs while exercising Step 3. If you see `Cannot find package '@aws-sdk/...'`, bundle the three SDK packages into `src/` and redeploy (the only contingency; the design assumes the runtime SDK).

- [ ] **Step 3: Exercise the real path in a browser**

1. From `https://groundstatesociety.com` (or a preview), submit a real email in the Signal form. Confirm a generic success ("Check your inbox").
2. Confirm the magic-link email **actually arrives** (requires SES production access, or a verified test recipient if still in sandbox).
3. Click the link → land on `quantum.altivum.ai/verify` (the static page exists after Plan 2; until then, POST the token to `/verify` manually with `curl -i --data '{"token":"…"}'` and confirm a `Set-Cookie: session=…; HttpOnly; Secure; SameSite=Lax; Domain=.altivum.ai` header).
4. In DynamoDB, confirm the `EMAIL#…` item is `status=confirmed` with no `ttl`, the right `source`, and a `consentIp`/`consentAt`/`confirmedAt`; confirm the `TOKEN#…` item is gone (single-use).
5. Re-click the same link → confirm `400 invalid_token` (single-use holds).

- [ ] **Step 4: Verify the abuse + no-enumeration behavior**

`curl` `/subscribe` with a filled `website` honeypot → `200`, and confirm **no** new DynamoDB item and **no** email. `curl` a known-existing confirmed email → identical generic `200`, no second email.

- [ ] **Step 5: Record results**

Note in `backend/subscribe/README.md`: the deployed `ApiUrl`, the SES production-access state, and that the live path was exercised (date + what was observed). Only now is Plan 1 "working."

---

## Self-Review

**Spec coverage (Plan 1 portions of the design spec):**
- D1 double opt-in → Tasks 3 (`pending`→`confirmed`), 4 (magic link), 6 (`/verify`). ✓
- D2 unified source-tagged list → Tasks 3 (`source` attr), 5 (`source` allowlist), 9 (`source: 'signal'`). ✓
- Session credential (D3 dependency) → Tasks 1 (`signSession`), 2 (cookie), 6 (mint). ✓
- Data model (EMAIL#/TOKEN#, TTL, consent) → Task 3 + Task 7 table. ✓
- SES setup + long-pole → Task 0. ✓
- CORS two-origin + credentials, no `*` → Task 7. ✓
- Abuse: honeypot, throttle, single-use hashed token, constant-time, no enumeration → Tasks 1, 3, 5, 7. ✓
- Alarms cloned from checkout → Task 7. ✓
- Live verification rule → Task 10. ✓
- **Out of scope (Plan 2, module session):** content API, REQUEST authorizer, jti revocation denylist read, `/learn` rendering refactor, gated notebooks, no-leak CI test, the static `/verify` page. Flagged in the header.

**Placeholder scan:** none — every code step carries complete code; Task 0/10 are ops with exact commands; Task 8 README and Task 9 `.env`/README steps describe concrete content. The `<regional-acm-cert-arn>` and `RegionalDomainTarget` are genuine deploy-time values, not placeholders for logic.

**Type/name consistency:** `createPending({email, source, tokenHash, consentIp})`, `consumeToken(tokenHash)→{email}|null`, `confirm(email)→bool`, `hashToken`, `signSession`, `buildSessionCookie`, `makeHandler({store,email})` are used identically across Tasks 3-6 and 8. Env var names match between `handler.mjs`, `store.mjs`, `email.mjs`, `cookies.mjs`, and `template.yaml`. Cookie name `session` consistent. ✓

---

## Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven (recommended)** — a fresh subagent per task, two-stage review between tasks.
2. **Inline Execution** — batch execution in this session with checkpoints.

Which approach?
