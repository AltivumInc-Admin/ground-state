# First Signal Issue — Publish & Send Runbook

Everything the first (and every) issue publish involves, collected from the
2026-07 hardening waves. Two independent halves: the **web publish** (Studio →
site) and the **email send** (operator CLI → Postmark). Do them in that order —
the email links to the live web page.

## 1. Author & publish (Studio: groundstate.sanity.studio)

- Draft the issue. Field notes that now enforce themselves: link URLs are
  **required** (an empty link popover blocks publish), image **alt is a hard
  error**, the slug must be `lowercase-hyphens`.
- **Check `Published at`** — it pre-fills when the draft was CREATED. If
  drafting spanned days, update it: it is the public page date, the email
  header date, and the archive sort key.
- **The two-gate rule** (also stated on the field itself): the site and the
  email CLI only see issues that are BOTH set to *Published* on the
  `Visibility (site + email)` radio AND published with Sanity's **Publish
  button**. One without the other = a no-show.
- Publishing fires the rebuild webhook automatically
  (`docs/runbooks/signal-publish-webhook.md`) — no manual build needed.

## 2. Verify the web side

- Watch the Amplify build log (`Amplify console → main`): expect
  `fetch-issues: querying pe7zq1it/production …` then
  `wrote 1 of 1 fetched (dropped 0)`. Any `kept with an empty body` warning
  means the issue will render hollow — fix in Studio and republish.
- Live checks: `https://groundstatesociety.com/signal` lists the issue;
  `/signal/<slug>` renders it; `sitemap.xml` includes it.

## 3. FLIP: remove `GSS_ALLOW_EMPTY_ISSUES` (re-arms the zero-issue guard)

The flag was set 2026-07-03 so pre-first-issue production builds pass the
zero-issue guard. Once an issue is published it is STALE — leaving it set
means a future wrong-dataset/credential regression could silently delist the
archive again. The build log now nags about this on every post-publish build
until removed.

- Easiest: Amplify console → App settings → Environment variables → delete
  the `GSS_ALLOW_EMPTY_ISSUES` row → save (applies on the next build).
- CLI alternative — CAUTION: `aws amplify update-app --environment-variables`
  REPLACES the entire map. Fetch the current map first
  (`aws amplify get-app --app-id d2c0upa00yly4w --profile ground-state
  --region us-east-1 --query 'app.environmentVariables'`), remove only the
  flag key, and pass back ALL remaining variables.
- Verify: the next build's log shows neither the stale-flag nag nor the
  empty-list warning.

## 4. Email send-day (operator CLI — `backend/broadcast/`)

- Env: see `backend/broadcast/README.md` — extract `POSTMARK_TOKEN`
  field-only via command substitution (never print the whole secret;
  never paste the token into a command line).
- **Dry run first**: `node send-issue.mjs <slug>` — read the summary
  (recipient count, `unknownTypes` must be `[]`), then eyeball the rendered
  email at `backend/broadcast/preview/<slug>.html` and `.txt`.
- **Live send**: `node send-issue.mjs <slug> --send` — after the summary you
  must type the exact recipient count. Exit codes: `0` clean · `1`
  per-recipient failures (see the printed `failures`) · `2` aborted mid-run
  (the message says how many were confirmed sent and how many remain — the
  resume decision keys off it).
- Postmark stream ramp note: ≤20k messages/hour for a new broadcast stream's
  first 12 hours — irrelevant at the current list size.

## 5. Post-send

- Bounces, complaints, and one-click unsubscribes flow back into DynamoDB
  automatically via `/postmark-webhook` — no action.
- The fleet's alarms page christian.perez@altivum.io (verified live
  2026-07-03) — a `notify_failed` or subscribe-path alarm now means a real
  problem.

## Post-launch watch item (separate flip)

`invalid_signature` webhook rejections on the checkout stack are DELIBERATELY
alarmed (a wrong live-mode signing secret makes every real Stripe delivery
fail verification — the silent-dead-ledger case). Internet scanners can
trigger the same alarm. If scanner noise materializes post-launch, split the
metric per the comment at `backend/checkout/template.yaml`'s
`CheckoutFailureMetricFilter` — do NOT simply mute the term.
