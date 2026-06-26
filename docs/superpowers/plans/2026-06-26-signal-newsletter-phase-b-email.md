# The Signal Newsletter — Phase B (Email Distribution) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send each published Sanity issue, full-text, to confirmed subscribers as an email via Postmark's Broadcast stream, with one-click unsubscribe synced back to DynamoDB.

**Architecture:** A standalone operator CLI (`backend/broadcast/`) fetches a published issue from Sanity, renders its Portable Text to email-safe HTML (with Postmark's `{{{ pm:unsubscribe }}}` placeholder), scans the existing `subscribers` DynamoDB table for `confirmed` addresses, and sends via Postmark's `/email/batch` endpoint on a dedicated `broadcast` Message Stream (separate reputation from the transactional `outbound` stream). Postmark manages the unsubscribe link + `List-Unsubscribe` headers and fires a **SubscriptionChange** webhook on unsubscribe; the **existing** `backend/subscribe` Lambda's `/postmark-webhook` route is extended to mark those addresses `unsubscribed` so the next send excludes them.

**Tech Stack:** Node 22 (ESM, dependency-light); `@sanity/client` + `@portabletext/to-html` (CLI only); `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb`; Postmark HTTPS Email API (`/email/batch`); the existing SAM `gss-subscribe` stack (us-east-2, account 659220242594, profile `ground-state`).

## Global Constraints

- **Code style:** No semicolons, single quotes, 2-space indent, ESM. Match existing `backend/subscribe/src/*.mjs`.
- **No emojis** anywhere; quiet, honest copy (no scarcity/hype) — matches the confirmation email and project intent.
- **The subscribe Lambda stays dependency-light.** Do NOT add `@sanity/client`, `@portabletext/to-html`, or any new runtime dep to `backend/subscribe`. The send tool lives in a separate `backend/broadcast/` package whose deps never reach the Lambda bundle.
- **Recipients = `status == 'confirmed'` only.** `pending`, `suppressed` (bounce/complaint), and `unsubscribed` addresses are excluded.
- **Full-text email (D5):** the entire issue body goes in the email; the public `/signal/<slug>` page is the discovery channel, not a teaser wall.
- **Broadcast stream is separate from `outbound`.** `MessageStream: 'broadcast'`. Never send the newsletter on the transactional stream.
- **Postmark manages unsubscribes** on the broadcast stream (recommended): the body MUST contain `{{{ pm:unsubscribe }}}`; Postmark adds the one-click `List-Unsubscribe`/`List-Unsubscribe-Post` headers and auto-suppresses unsubscribers on that stream.
- **Compliance:** every issue email includes the unsubscribe link, a physical/operator identity line, and a "why you're getting this" line (CAN-SPAM / Gmail-Yahoo bulk requirements).
- **Tests:** Node `node --test` for all `backend/**` code. The root `npm test` runs `backend/checkout` + `backend/subscribe` suites; add `backend/broadcast/test/*.test.mjs` to that script.
- **Table:** single-table, `PK = "EMAIL#<lowercased-email>"`, attribute `status` ∈ `pending|confirmed|suppressed|unsubscribed`. `TOKEN#<hash>` items also exist (short-lived) and must be excluded from recipient scans.
- **Verify external shapes before trusting them:** Postmark `/email/batch` response and SubscriptionChange payload are verified in this plan against current docs (cited in §Verification), but re-confirm against a real Postmark test send during Task 6.

---

### Task 1: Sync unsubscribes — extend the subscribe Lambda

**Files:**
- Modify: `backend/subscribe/src/store.mjs` (add `unsubscribe`)
- Modify: `backend/subscribe/src/handler.mjs` (handle `SubscriptionChange` in `postmarkWebhook`)
- Modify: `backend/subscribe/test/store.test.mjs`
- Modify: `backend/subscribe/test/handler.test.mjs`

**Interfaces:**
- Consumes: existing `store.suppress` pattern, the existing `/postmark-webhook` route + Basic-auth.
- Produces: `store.unsubscribe({ email })` → sets `status = 'unsubscribed'` (re-subscribable, unlike `suppressed`); the webhook marks an address `unsubscribed` on a `SubscriptionChange` with `SuppressSending === true`.

- [ ] **Step 1: Write the failing store test** (append to `backend/subscribe/test/store.test.mjs`)

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unsubscribe } from '../src/store.mjs'

test('unsubscribe sets status to unsubscribed (UpdateCommand)', async () => {
  process.env.TABLE_NAME = 'test-table'
  let sent
  const realSend = (await import('../src/store.mjs')).ddb.send
  ;(await import('../src/store.mjs')).ddb.send = async (cmd) => { sent = cmd }
  await unsubscribe({ email: 'a@b.com' })
  ;(await import('../src/store.mjs')).ddb.send = realSend
  assert.equal(sent.input.Key.PK, 'EMAIL#a@b.com')
  assert.equal(sent.input.ExpressionAttributeValues[':u'], 'unsubscribed')
})
```

(If the existing store tests use a different mock seam — e.g. injecting a fake client — mirror that exact pattern instead. Read `backend/subscribe/test/store.test.mjs` first and match it.)

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test backend/subscribe/test/store.test.mjs`
Expected: FAIL — `unsubscribe` is not exported.

- [ ] **Step 3: Add `unsubscribe` to `store.mjs`** (after the `suppress` function)

```javascript
// Mark an address unsubscribed after Postmark reports a SubscriptionChange
// (SuppressSending=true) on the broadcast stream. Distinct from `suppress`:
// an unsubscribe is re-subscribable (createPending's guard only blocks
// 'confirmed' and 'suppressed'), so a user can opt back in later.
export async function unsubscribe({ email }) {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE(),
      Key: { PK: `EMAIL#${email}` },
      UpdateExpression: 'SET #s = :u, unsubscribedAt = :now REMOVE #ttl',
      ConditionExpression: 'attribute_exists(PK) AND #s <> :suppressed',
      ExpressionAttributeNames: { '#s': 'status', '#ttl': 'ttl' },
      ExpressionAttributeValues: {
        ':u': 'unsubscribed',
        ':suppressed': 'suppressed',
        ':now': nowSec(),
      },
    }),
  ).catch((e) => {
    // No record, or already suppressed (bounce/complaint outranks unsubscribe) — both fine.
    if (e?.name !== 'ConditionalCheckFailedException') throw e
  })
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test backend/subscribe/test/store.test.mjs`
Expected: PASS.

- [ ] **Step 5: Write the failing handler test** (append to `backend/subscribe/test/handler.test.mjs`, matching the file's existing `makeHandler({ store })` injection style)

```javascript
test('postmark-webhook: SubscriptionChange with SuppressSending unsubscribes the recipient', async () => {
  process.env.POSTMARK_WEBHOOK_SECRET = 'sek'
  const calls = []
  const handler = makeHandler({ store: { unsubscribe: async (a) => calls.push(a), suppress: async () => {} } })
  const auth = 'Basic ' + Buffer.from('postmark:sek').toString('base64')
  const res = await handler({
    requestContext: { http: { method: 'POST' } },
    rawPath: '/postmark-webhook',
    headers: { authorization: auth },
    body: JSON.stringify({ RecordType: 'SubscriptionChange', SuppressSending: true, Recipient: 'X@Y.com', SuppressionReason: 'ManualSuppression', Origin: 'Recipient' }),
  })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(calls, [{ email: 'x@y.com' }])
})

test('postmark-webhook: SubscriptionChange reactivation (SuppressSending=false) does nothing', async () => {
  process.env.POSTMARK_WEBHOOK_SECRET = 'sek'
  const calls = []
  const handler = makeHandler({ store: { unsubscribe: async (a) => calls.push(a), suppress: async () => {} } })
  const auth = 'Basic ' + Buffer.from('postmark:sek').toString('base64')
  const res = await handler({
    requestContext: { http: { method: 'POST' } },
    rawPath: '/postmark-webhook',
    headers: { authorization: auth },
    body: JSON.stringify({ RecordType: 'SubscriptionChange', SuppressSending: false, Recipient: 'x@y.com' }),
  })
  assert.equal(res.statusCode, 200)
  assert.equal(calls.length, 0)
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `node --test backend/subscribe/test/handler.test.mjs`
Expected: FAIL — SubscriptionChange is currently ignored (no `unsubscribe` call).

- [ ] **Step 7: Handle SubscriptionChange in `handler.mjs`** (inside `postmarkWebhook`, after the existing `suppress` block, before the final `return json(200, …)`)

```javascript
    // Unsubscribe sync (broadcast stream). Postmark fires SubscriptionChange when a
    // recipient uses the one-click unsubscribe; SuppressSending=true means deactivate.
    // The email is in `Recipient` (NOT `Email`). Reactivations (false) are ignored.
    if (payload?.RecordType === 'SubscriptionChange' && payload.SuppressSending === true) {
      const rcpt = typeof payload.Recipient === 'string' ? payload.Recipient.trim().toLowerCase() : ''
      if (rcpt) {
        await store.unsubscribe({ email: rcpt })
        console.log(JSON.stringify({ at: 'unsubscribed', origin: payload.Origin, reason: payload.SuppressionReason }))
      }
    }
```

- [ ] **Step 8: Run it to verify it passes**

Run: `node --test backend/subscribe/test/handler.test.mjs`
Expected: PASS (both new tests + existing).

- [ ] **Step 9: Commit**

```bash
git add backend/subscribe/src/store.mjs backend/subscribe/src/handler.mjs backend/subscribe/test/store.test.mjs backend/subscribe/test/handler.test.mjs
git commit -m "feat(signal): sync Postmark broadcast unsubscribes to DynamoDB"
```

---

### Task 2: Broadcast package scaffold + confirmed-recipient scan

**Files:**
- Create: `backend/broadcast/package.json`
- Create: `backend/broadcast/src/recipients.mjs`
- Create: `backend/broadcast/src/chunk.mjs`
- Create: `backend/broadcast/test/recipients.test.mjs`
- Create: `backend/broadcast/test/chunk.test.mjs`
- Modify: root `package.json` (`test` script includes `backend/broadcast/test/*.test.mjs`)

**Interfaces:**
- Produces: `listConfirmedRecipients(tableName)` → `Promise<string[]>` (lowercased emails, paginated Scan); `chunk(arr, size)` → `T[][]`.

- [ ] **Step 1: Create `backend/broadcast/package.json`**

```json
{
  "name": "gss-broadcast",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "description": "Operator CLI to send a published Signal issue to confirmed subscribers via Postmark Broadcast.",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.1071.0",
    "@aws-sdk/lib-dynamodb": "^3.1071.0",
    "@portabletext/to-html": "^2.0.14",
    "@sanity/client": "^7.12.0"
  }
}
```

(Pin `@sanity/client` to the version already in the repo root — check root `package-lock.json` and match it. `@portabletext/to-html` version: use the current `^2` line; Task 3 verifies it imports.)

- [ ] **Step 2: Write the failing chunk test** (`backend/broadcast/test/chunk.test.mjs`)

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chunk } from '../src/chunk.mjs'

test('chunk splits into size-capped groups', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
})
test('chunk of empty is empty', () => {
  assert.deepEqual(chunk([], 500), [])
})
```

- [ ] **Step 3: Run it (fails), implement, run (passes)**

Run: `node --test backend/broadcast/test/chunk.test.mjs` → FAIL.

Create `backend/broadcast/src/chunk.mjs`:

```javascript
export function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
```

Run again → PASS.

- [ ] **Step 4: Write the failing recipients test** (`backend/broadcast/test/recipients.test.mjs`)

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildScanParams, collectEmails } from '../src/recipients.mjs'

test('buildScanParams filters EMAIL# items with confirmed status', () => {
  const p = buildScanParams('t', { lastKey: undefined })
  assert.equal(p.TableName, 't')
  assert.match(p.FilterExpression, /begins_with\(PK, :p\)/)
  assert.equal(p.ExpressionAttributeValues[':p'], 'EMAIL#')
  assert.equal(p.ExpressionAttributeValues[':c'], 'confirmed')
})

test('collectEmails strips the EMAIL# prefix', () => {
  const items = [{ PK: 'EMAIL#a@b.com' }, { PK: 'EMAIL#c@d.com' }]
  assert.deepEqual(collectEmails(items), ['a@b.com', 'c@d.com'])
})
```

- [ ] **Step 5: Run it (fails), implement, run (passes)**

Run: `node --test backend/broadcast/test/recipients.test.mjs` → FAIL.

Create `backend/broadcast/src/recipients.mjs`:

```javascript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

export function buildScanParams(tableName, { lastKey }) {
  return {
    TableName: tableName,
    FilterExpression: 'begins_with(PK, :p) AND #s = :c',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':p': 'EMAIL#', ':c': 'confirmed' },
    ProjectionExpression: 'PK',
    ExclusiveStartKey: lastKey,
  }
}

export function collectEmails(items) {
  return (items ?? []).map((i) => i.PK.slice('EMAIL#'.length))
}

// Paginated Scan. The list is small at launch, so Scan is acceptable; if it ever
// grows large, add a GSI on `status` and Query instead.
export async function listConfirmedRecipients(tableName, client = ddb) {
  const emails = []
  let lastKey
  do {
    const res = await client.send(new ScanCommand(buildScanParams(tableName, { lastKey })))
    emails.push(...collectEmails(res.Items))
    lastKey = res.LastEvaluatedKey
  } while (lastKey)
  return emails
}
```

Run again → PASS.

- [ ] **Step 6: Add broadcast tests to the root `test` script** (`package.json`)

Change `test` to also run the new suite:

```json
"test": "node --test \"backend/checkout/test/*.test.mjs\" \"backend/subscribe/test/*.test.mjs\" \"backend/broadcast/test/*.test.mjs\"",
```

- [ ] **Step 7: Install broadcast deps + run its suite**

Run: `cd backend/broadcast && npm install && node --test test/*.test.mjs`
Expected: PASS (chunk + recipients).

- [ ] **Step 8: Commit**

```bash
git add backend/broadcast/package.json backend/broadcast/package-lock.json backend/broadcast/src/chunk.mjs backend/broadcast/src/recipients.mjs backend/broadcast/test/ package.json
git commit -m "feat(signal): broadcast package + confirmed-recipient scan"
```

---

### Task 3: Issue fetch + email rendering

**Files:**
- Create: `backend/broadcast/src/issue-email.mjs`
- Create: `backend/broadcast/test/issue-email.test.mjs`

**Interfaces:**
- Consumes: `@sanity/client`, `@portabletext/to-html`.
- Produces:
  - `fetchIssue({ slug, projectId, dataset, apiVersion })` → `Promise<issue | null>` (issue shape: `{ slug, title, publishedAt, excerpt, body, seo }`, with `pteImage` blocks carrying a resolved `url`).
  - `renderIssueEmail({ issue, siteUrl })` → `{ subject, html, text }`. The HTML/text MUST contain the literal `{{{ pm:unsubscribe }}}` placeholder and the compliance footer.

- [ ] **Step 1: Write the failing test** (`backend/broadcast/test/issue-email.test.mjs`)

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderIssueEmail } from '../src/issue-email.mjs'

const issue = {
  slug: 'funding-roundup-q2',
  title: 'Funding Roundup: Q2',
  publishedAt: '2026-06-24T00:00:00Z',
  excerpt: 'Big week: $1.2B raised.',
  seo: {},
  body: [
    { _type: 'block', style: 'h2', _key: '1', markDefs: [], children: [{ _type: 'span', _key: 's1', text: 'The rounds', marks: [] }] },
    { _type: 'block', style: 'normal', _key: '2', markDefs: [{ _type: 'link', _key: 'l1', href: 'https://x.test' }], children: [{ _type: 'span', _key: 's2', text: '$2M seed', marks: ['l1'] }] },
    { _type: 'pteImage', _key: '3', url: 'https://cdn.test/a.png', alt: 'a particle', caption: 'Fig 1' },
  ],
}

test('renderIssueEmail produces subject, html, text', () => {
  const { subject, html, text } = renderIssueEmail({ issue, siteUrl: 'https://groundstatesociety.com' })
  assert.equal(subject, 'Funding Roundup: Q2')
  // Body rendered
  assert.match(html, /The rounds/)
  assert.match(html, /href="https:\/\/x\.test"/)
  assert.match(html, /\$2M seed/) // dollar figure intact
  assert.match(html, /<img[^>]+src="https:\/\/cdn\.test\/a\.png"[^>]+alt="a particle"/)
  // Compliance: unsubscribe placeholder + identity + canonical link to the web version
  assert.match(html, /\{\{\{ pm:unsubscribe \}\}\}/)
  assert.match(html, /Altivum Inc/)
  assert.match(html, /groundstatesociety\.com\/signal\/funding-roundup-q2/)
  assert.match(text, /\{\{\{ pm:unsubscribe \}\}\}/)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test backend/broadcast/test/issue-email.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `issue-email.mjs`**

```javascript
import { createClient } from '@sanity/client'
import { toHTML } from '@portabletext/to-html'

const ISSUE_QUERY = `*[_type == "issue" && status == "published" && slug.current == $slug][0]{
  "slug": slug.current,
  title,
  publishedAt,
  excerpt,
  "seo": { "title": coalesce(seo.title, title), "noIndex": seo.noIndex == true },
  body[]{
    ...,
    _type == "pteImage" => { ..., "url": image.asset->url }
  }
}`

export async function fetchIssue({ slug, projectId, dataset, apiVersion = '2026-06-01' }) {
  const client = createClient({ projectId, dataset, apiVersion, useCdn: false })
  return client.fetch(ISSUE_QUERY, { slug })
}

// Email-safe serializers. Inline styles only; no class hooks survive in email.
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const components = {
  block: {
    h2: ({ children }) => `<h2 style="margin:28px 0 10px;font:700 20px/1.3 ${FONT};color:#08080a;">${children}</h2>`,
    h3: ({ children }) => `<h3 style="margin:24px 0 8px;font:700 16px/1.3 ${FONT};color:#432d16;">${children}</h3>`,
    blockquote: ({ children }) => `<blockquote style="margin:18px 0;padding:4px 0 4px 16px;border-left:2px solid #b7a781;font:400 17px/1.6 ${FONT};color:#432d16;">${children}</blockquote>`,
    normal: ({ children }) => `<p style="margin:0 0 16px;font:400 15px/1.7 ${FONT};color:#432d16;">${children}</p>`,
  },
  marks: {
    strong: ({ children }) => `<strong>${children}</strong>`,
    em: ({ children }) => `<em>${children}</em>`,
    link: ({ children, value }) => `<a href="${value?.href ?? '#'}" style="color:#4a6878;">${children}</a>`,
  },
  types: {
    pteImage: ({ value }) =>
      value?.url
        ? `<figure style="margin:22px 0;"><img src="${value.url}" alt="${value.alt ?? ''}" style="display:block;width:100%;border:1px solid #e6e6ef;"/>${value.caption ? `<figcaption style="margin-top:8px;font:400 12px/1.5 ${FONT};color:#9a9aa6;">${value.caption}</figcaption>` : ''}</figure>`
        : '',
  },
}

const FROM_NAME = 'The Ground State Society'
const ENTITY = 'The Ground State Society · operated by Altivum Inc.'
const WHY = 'You are receiving this because you confirmed your subscription to The Signal at groundstatesociety.com.'

export function renderIssueEmail({ issue, siteUrl }) {
  const bodyHtml = toHTML(issue.body ?? [], { components })
  const webUrl = `${siteUrl}/signal/${issue.slug}`
  const date = issue.publishedAt
    ? new Date(issue.publishedAt).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f7ff;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f7f7ff;">${issue.excerpt ?? ''}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7ff;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid #e6e6ef;border-radius:10px;">
        <tr><td style="padding:28px 32px 0;">
          <p style="margin:0;font:600 12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;color:#b7a781;">The Signal</p>
        </td></tr>
        <tr><td style="padding:14px 32px 0;">
          <h1 style="margin:0 0 6px;font:700 24px/1.25 ${FONT};color:#08080a;">${issue.title}</h1>
          <p style="margin:0 0 20px;font:400 12px/1.5 ui-monospace,monospace;color:#9a9aa6;">${date}</p>
        </td></tr>
        <tr><td style="padding:0 32px;">${bodyHtml}</td></tr>
        <tr><td style="padding:8px 32px 0;">
          <p style="margin:0;font:400 13px/1.6 ${FONT};color:#6b6b76;">Read this issue on the web: <a href="${webUrl}" style="color:#4a6878;">${webUrl}</a></p>
        </td></tr>
        <tr><td style="padding:20px 32px;"><hr style="border:0;border-top:1px solid #e6e6ef;margin:0;"></td></tr>
        <tr><td style="padding:0 32px 28px;">
          <p style="margin:0 0 6px;font:400 12px/1.6 ${FONT};color:#9a9aa6;">${WHY}</p>
          <p style="margin:0 0 6px;font:400 12px/1.6 ${FONT};color:#9a9aa6;">${ENTITY}</p>
          <p style="margin:0;font:400 12px/1.6 ${FONT};color:#9a9aa6;">{{{ pm:unsubscribe }}}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  const text = `THE SIGNAL

${issue.title}
${date}

${issue.excerpt ?? ''}

Read on the web: ${webUrl}

—
${WHY}
${ENTITY}
{{{ pm:unsubscribe }}}`

  return { subject: issue.title, html, text, fromName: FROM_NAME }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test backend/broadcast/test/issue-email.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/broadcast/src/issue-email.mjs backend/broadcast/test/issue-email.test.mjs
git commit -m "feat(signal): fetch + render an issue to broadcast email HTML"
```

---

### Task 4: Postmark batch sender

**Files:**
- Create: `backend/broadcast/src/postmark.mjs`
- Create: `backend/broadcast/test/postmark.test.mjs`

**Interfaces:**
- Consumes: `chunk` (Task 2); injectable `fetchImpl` for testing.
- Produces: `sendIssue({ recipients, subject, html, text, fromName, fromAddress, token, fetchImpl })` → `Promise<{ sent, failed: [{ email, code, message }] }>`. Sends on `MessageStream: 'broadcast'` in batches of 500 via `POST https://api.postmarkapp.com/email/batch`.

- [ ] **Step 1: Write the failing test** (`backend/broadcast/test/postmark.test.mjs`)

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildBatch, sendIssue } from '../src/postmark.mjs'

test('buildBatch creates one broadcast message per recipient', () => {
  const msgs = buildBatch({ recipients: ['a@b.com', 'c@d.com'], subject: 'S', html: 'H', text: 'T', fromName: 'GSS', fromAddress: 'no-reply@gss.com' })
  assert.equal(msgs.length, 2)
  assert.equal(msgs[0].To, 'a@b.com')
  assert.equal(msgs[0].From, 'GSS <no-reply@gss.com>')
  assert.equal(msgs[0].MessageStream, 'broadcast')
  assert.equal(msgs[0].Subject, 'S')
})

test('sendIssue posts batches and collects per-recipient failures', async () => {
  const calls = []
  const fetchImpl = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) })
    // Postmark /email/batch returns an array of per-message results
    return { ok: true, json: async () => [
      { ErrorCode: 0, Message: 'OK', To: 'a@b.com' },
      { ErrorCode: 406, Message: 'Inactive recipient', To: 'c@d.com' },
    ] }
  }
  const res = await sendIssue({
    recipients: ['a@b.com', 'c@d.com'], subject: 'S', html: 'H', text: 'T',
    fromName: 'GSS', fromAddress: 'no-reply@gss.com', token: 'tok', fetchImpl,
  })
  assert.equal(calls[0].url, 'https://api.postmarkapp.com/email/batch')
  assert.equal(res.sent, 1)
  assert.deepEqual(res.failed, [{ email: 'c@d.com', code: 406, message: 'Inactive recipient' }])
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test backend/broadcast/test/postmark.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `postmark.mjs`**

```javascript
import { chunk } from './chunk.mjs'

const BATCH_URL = 'https://api.postmarkapp.com/email/batch'
const STREAM = 'broadcast'
const BATCH_SIZE = 500 // Postmark hard cap per /email/batch request

export function buildBatch({ recipients, subject, html, text, fromName, fromAddress }) {
  return recipients.map((to) => ({
    From: `${fromName} <${fromAddress}>`,
    To: to,
    Subject: subject,
    HtmlBody: html,
    TextBody: text,
    MessageStream: STREAM,
    // Open tracking is fine for a newsletter; leave link tracking off so URLs
    // are not rewritten through Postmark's redirect domain.
    TrackOpens: true,
    TrackLinks: 'None',
  }))
}

export async function sendIssue({ recipients, subject, html, text, fromName, fromAddress, token, fetchImpl = fetch }) {
  let sent = 0
  const failed = []
  for (const group of chunk(recipients, BATCH_SIZE)) {
    const messages = buildBatch({ recipients: group, subject, html, text, fromName, fromAddress })
    const res = await fetchImpl(BATCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Postmark-Server-Token': token,
      },
      body: JSON.stringify(messages),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`postmark_batch_failed ${res.status}: ${detail}`)
    }
    const results = await res.json()
    for (const r of results) {
      if (r.ErrorCode === 0) sent += 1
      else failed.push({ email: r.To, code: r.ErrorCode, message: r.Message })
    }
  }
  return { sent, failed }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `node --test backend/broadcast/test/postmark.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/broadcast/src/postmark.mjs backend/broadcast/test/postmark.test.mjs
git commit -m "feat(signal): Postmark /email/batch broadcast sender"
```

---

### Task 5: The send-issue CLI (dry-run by default)

**Files:**
- Create: `backend/broadcast/send-issue.mjs`
- Create: `backend/broadcast/README.md`

**Interfaces:**
- Consumes: `fetchIssue`, `renderIssueEmail` (Task 3); `listConfirmedRecipients` (Task 2); `sendIssue` (Task 4).
- Produces: a CLI: `node send-issue.mjs <slug> [--send]`. **Dry-run by default** — fetches, renders, scans, and prints (subject, recipient count, a 3-address sample, and whether the unsubscribe placeholder is present) but sends nothing. `--send` performs the real batch send.

- [ ] **Step 1: Implement `send-issue.mjs`**

```javascript
/*
 * Operator CLI — send one PUBLISHED Signal issue to confirmed subscribers via
 * Postmark Broadcast. Dry-run by default; pass --send to actually send.
 *
 *   node send-issue.mjs <slug>            # dry run: counts + preview, no send
 *   node send-issue.mjs <slug> --send     # real batch send
 *
 * Env (no secrets in argv): TABLE_NAME, SANITY_PROJECT_ID, SANITY_DATASET,
 *   POSTMARK_TOKEN, FROM_ADDRESS, AWS_REGION/AWS_PROFILE (DynamoDB access).
 *   SITE_URL defaults to https://groundstatesociety.com.
 */
import { fetchIssue, renderIssueEmail } from './src/issue-email.mjs'
import { listConfirmedRecipients } from './src/recipients.mjs'
import { sendIssue } from './src/postmark.mjs'

function req(name) {
  const v = process.env[name]
  if (!v) { console.error(`Missing env: ${name}`); process.exit(1) }
  return v
}

async function main() {
  const slug = process.argv[2]
  const doSend = process.argv.includes('--send')
  if (!slug || slug.startsWith('--')) { console.error('Usage: node send-issue.mjs <slug> [--send]'); process.exit(1) }

  const siteUrl = process.env.SITE_URL || 'https://groundstatesociety.com'
  const issue = await fetchIssue({
    slug,
    projectId: req('SANITY_PROJECT_ID'),
    dataset: process.env.SANITY_DATASET || 'production',
  })
  if (!issue) { console.error(`No PUBLISHED issue with slug "${slug}"`); process.exit(1) }

  const { subject, html, text, fromName } = renderIssueEmail({ issue, siteUrl })
  const recipients = await listConfirmedRecipients(req('TABLE_NAME'))

  const hasUnsub = html.includes('{{{ pm:unsubscribe }}}') && text.includes('{{{ pm:unsubscribe }}}')
  console.log(JSON.stringify({
    slug, subject, recipients: recipients.length,
    sample: recipients.slice(0, 3), unsubscribePlaceholder: hasUnsub, mode: doSend ? 'SEND' : 'DRY-RUN',
  }, null, 2))

  if (!hasUnsub) { console.error('Refusing to send: unsubscribe placeholder missing'); process.exit(1) }
  if (recipients.length === 0) { console.error('No confirmed recipients.'); process.exit(1) }
  if (!doSend) { console.log('Dry run — nothing sent. Re-run with --send to send.'); return }

  const result = await sendIssue({
    recipients, subject, html, text, fromName,
    fromAddress: req('FROM_ADDRESS'), token: req('POSTMARK_TOKEN'),
  })
  console.log(JSON.stringify({ sent: result.sent, failed: result.failed.length }, null, 2))
  if (result.failed.length) console.error(JSON.stringify({ failures: result.failed }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Smoke-test the CLI guards (no network)**

Run: `cd backend/broadcast && node send-issue.mjs` (no slug)
Expected: prints usage, exits 1.

Run: `node send-issue.mjs some-slug` with `SANITY_PROJECT_ID` unset
Expected: `Missing env: SANITY_PROJECT_ID`, exits 1.

(A full dry run against live Sanity + DynamoDB is exercised in Task 6.)

- [ ] **Step 3: Write `backend/broadcast/README.md`**

Document: purpose; required env vars (and that `POSTMARK_TOKEN` comes from the `gss/subscribe` Secrets Manager secret — `aws secretsmanager get-secret-value --secret-id gss/subscribe --region us-east-2 --profile ground-state`); the broadcast Message Stream must exist with Postmark-managed unsubscribes; dry-run vs `--send`; that issues must be `status=published` in Sanity; the Postmark ramp-up note (≤20k/hr for the first 12h of a stream's life — irrelevant at current list size); and that bounces/complaints/unsubscribes flow back to DynamoDB via the existing `/postmark-webhook`.

- [ ] **Step 4: Commit**

```bash
git add backend/broadcast/send-issue.mjs backend/broadcast/README.md
git commit -m "feat(signal): send-issue CLI (dry-run default) + broadcast README"
```

---

### Task 6: Postmark broadcast stream + webhook setup, and live verification

**Files:** none (operator setup + live verification per the project's "run the real thing" rule).

- [ ] **Step 1: Create the broadcast Message Stream in Postmark**

In the Postmark server → Message Streams → Create → type **Broadcasts**, id `broadcast`. Under its settings, keep **"Let Postmark manage unsubscribes"** (default) so Postmark injects the unsubscribe link + `List-Unsubscribe`/`List-Unsubscribe-Post` headers and auto-suppresses unsubscribers on this stream.

- [ ] **Step 2: Wire the SubscriptionChange webhook for the broadcast stream**

In the `broadcast` stream → Webhooks → add a webhook to the existing endpoint `https://api.groundstatesociety.com/postmark-webhook`, with HTTP Basic auth user `postmark` and the `POSTMARK_WEBHOOK_SECRET` (same secret already used for the transactional bounce/complaint webhook), and enable the **Subscription Change** event. Confirm a test delivery returns 200.

- [ ] **Step 3: Verify the SubscriptionChange payload shape against a real event**

Send a test broadcast to a seed address you control, click the unsubscribe link, and capture the webhook payload (Postmark Activity → the SubscriptionChange event, or a temporary log). Confirm the field names used in Task 1 are correct: `RecordType: "SubscriptionChange"`, `Recipient`, `SuppressSending: true`, `Origin: "Recipient"`. If they differ, fix Task 1's handler and re-run its tests before proceeding.

- [ ] **Step 4: Dry run against live data**

With a confirmed test subscriber in the table and a published test issue in Sanity:

```bash
cd backend/broadcast
SANITY_PROJECT_ID=pe7zq1it SANITY_DATASET=production \
TABLE_NAME=<gss-subscribe table name> AWS_REGION=us-east-2 AWS_PROFILE=ground-state \
node send-issue.mjs <test-issue-slug>
```

Expected: prints the subject, a recipient count ≥ 1, `unsubscribePlaceholder: true`, `mode: DRY-RUN`, and sends nothing. (Get the table name from `aws cloudformation describe-stacks --stack-name gss-subscribe --region us-east-2 --profile ground-state --query "Stacks[0].Outputs"` or the stack's resources.)

- [ ] **Step 5: Real send to a test address, end-to-end**

Temporarily ensure the only confirmed recipient is a seed inbox you control (or accept sending to the real list only once verified). Add `POSTMARK_TOKEN` (from the `gss/subscribe` secret) and `FROM_ADDRESS=no-reply@groundstatesociety.com`, then run with `--send`. Verify:
- the email arrives, renders correctly in at least one major client, funding-dollar figures intact;
- the footer shows the unsubscribe link + identity + "why";
- clicking unsubscribe → the address flips to `unsubscribed` in DynamoDB (via the webhook) and a re-run dry-run no longer lists it;
- a `curl` of the issue's web URL still works (Phase A unaffected).

Mocked sends and green unit tests are not sufficient evidence; this step is the gate.

- [ ] **Step 6: Document in the publish runbook**

Append to `docs/runbooks/signal-publish-webhook.md` (or a new `signal-email-send.md`): the publish → `send-issue.mjs` flow, the broadcast stream id, the env vars, the ramp-up caveat, and the unsubscribe round-trip. Commit.

---

## Verification (Postmark facts this plan relies on)

Verified against current Postmark documentation:
- **Batch send:** use `POST /email/batch` (array of message objects, ≤500 per request) for bulk Broadcast sending; single-email endpoint is for one-off transactional only. [Message Streams API](https://postmarkapp.com/developer/api/message-streams-api), [Best practices for bulk broadcast sending](https://postmarkapp.com/guides/best-practices-for-broadcast-sending)
- **Unsubscribe link is required on Broadcast streams** and Postmark auto-injects it; placement via the `{{{ pm:unsubscribe }}}` placeholder; Postmark adds RFC 8058 one-click `List-Unsubscribe`/`List-Unsubscribe-Post` headers and auto-suppresses when it manages unsubscribes. [Why Broadcasts require an unsubscribe link](https://postmarkapp.com/support/article/1217-why-broadcasts-require-an-unsubscribe-link), [How to add an unsubscribe link](https://postmarkapp.com/support/article/1208-how-to-add-an-unsubscribe-link)
- **SubscriptionChange webhook** notifies on suppression changes; the email is in `Recipient`, with `SuppressSending` (true=deactivate) and `SuppressionReason`/`Origin`. [Subscription Change webhook](https://postmarkapp.com/developer/webhooks/subscription-change-webhook)
- **Ramp-up:** first 12h of a new Broadcast stream ≤20k messages/hour; keep spam <0.1%, bounce <10%; no overall cap. [Best practices for bulk broadcast sending](https://postmarkapp.com/guides/best-practices-for-broadcast-sending)

---

## Self-Review

**Spec coverage (against `2026-06-26-signal-newsletter-design.md` §7 + §14):**
- Render issue body → email-safe HTML (`@portabletext/to-html`, custom serializers) → Task 3. ✓
- Send via Postmark **Broadcast** stream, separate from `outbound` → Task 4 (`MessageStream: 'broadcast'`) + Task 6 (stream creation). ✓
- Recipients = confirmed subscribers, all sources (D4) → Task 2 (`status == 'confirmed'`; source-agnostic). ✓
- Full-text email (D5) → Task 3 renders the whole `body`. ✓
- One-click unsubscribe, instantly honored + synced → Postmark-managed link/headers (Task 6) + SubscriptionChange → DynamoDB `unsubscribed` (Task 1). ✓
- Honor Postmark suppression (bounce/complaint) → already live via `/postmark-webhook` (commit aa63080); unchanged, recipients exclude `suppressed`. ✓
- Physical-address / identity + "why" footer → Task 3 (`ENTITY` + `WHY`). ✓
- "Verify Postmark Broadcast mechanics before building" (spec §7/§10/§19) → §Verification + Task 6 Step 3 (verify SubscriptionChange against a real event). ✓
- Trigger mechanism (CLI vs Lambda vs Studio action — open in spec §10/§19) → **resolved: operator CLI**, dry-run by default (Task 5), with rationale (no public blast endpoint; deps off the Lambda). ✓
- Subscribe Lambda stays dependency-light → Task 1 adds no deps; send tool is a separate package (Task 2). ✓

**Placeholder scan:** No "TBD"/"handle errors"/"similar to Task N"; every code step is complete; commands have expected output. The two genuinely external unknowns (exact SubscriptionChange fields, `/email/batch` response) are written with verified values AND gated by a live re-check in Task 6 — not left as placeholders. ✓

**Type/name consistency:** `listConfirmedRecipients`/`collectEmails`/`buildScanParams` (Task 2) → `recipients` array consumed by Task 5; `renderIssueEmail` returns `{ subject, html, text, fromName }` (Task 3) consumed verbatim by Task 5 and passed into `sendIssue({ subject, html, text, fromName, fromAddress, token })` (Task 4). `chunk` (Task 2) used by Task 4. `unsubscribe({ email })` (Task 1 store) called by Task 1 handler. Consistent. ✓

---

## Execution Handoff

**Phase B plan complete. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, two-stage review between tasks. Tasks 1–5 are pure code (TDD, no live creds). Task 6 (Postmark stream + webhook + live send) is operator/interactive — you run it.

**2. Inline Execution** — execute tasks in this session via executing-plans with checkpoints.

Which approach?
