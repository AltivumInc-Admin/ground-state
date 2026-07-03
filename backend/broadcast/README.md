# broadcast

Operator tooling for sending Signal newsletter issues to confirmed subscribers via
Postmark Broadcast.

## Purpose

`send-issue.mjs` fetches a published Sanity issue, renders its HTML and plain-text
emails, pulls the confirmed-subscriber list from DynamoDB, and (optionally) fires a
batch send through Postmark. It is the final step in the Signal broadcast pipeline.

## Usage

```bash
# Dry run — prints the summary (subject, recipient count, 3-address sample,
# unsubscribe-placeholder check, any unknown Portable Text types) AND writes the
# rendered email to preview/<slug>.html + .txt for eyeballing. Nothing is sent.
node send-issue.mjs <slug>

# Real send — after the summary prints, you must type the exact recipient count
# to proceed (forces reading the summary). Batch delivery via Postmark Broadcast.
node send-issue.mjs <slug> --send

# Scripted send — skips the confirmation prompt.
node send-issue.mjs <slug> --send --yes
```

The slug must match `^[a-z0-9-]+$` and a `status=published` document in Sanity.
Drafts and unpublished issues are rejected.

**Exit codes:** `0` clean send (or dry run) · `1` refused / invalid input /
per-recipient failures (check the printed `failures`) · `2` **aborted mid-run** —
earlier batches WERE delivered; the abort message prints how many were confirmed
sent and how many remain unconfirmed, which is what the resume decision needs.

All required env is validated up front (missing names listed together), including
`AWS_REGION`/`AWS_PROFILE` — an unpinned scan could silently target the wrong
account's table. `POSTMARK_TOKEN`/`FROM_ADDRESS` are only required with `--send`.

## Required environment variables

| Variable | Purpose |
|---|---|
| `TABLE_NAME` | DynamoDB subscribers table name |
| `SANITY_PROJECT_ID` | Sanity project ID |
| `SANITY_DATASET` | Sanity dataset (defaults to `production`) |
| `POSTMARK_TOKEN` | Postmark server API token for the broadcast stream |
| `FROM_ADDRESS` | Sender email address (must be a verified Postmark sender) |
| `AWS_REGION` / `AWS_PROFILE` | DynamoDB access credentials |
| `SITE_URL` | Defaults to `https://groundstatesociety.com` |

`POSTMARK_TOKEN` lives in AWS Secrets Manager under `gss/subscribe`. Extract ONLY
that field via command substitution — never print the full multi-key secret into
scrollback, and never paste the token into a command line (shell history):

```bash
export POSTMARK_TOKEN=$(aws secretsmanager get-secret-value \
  --secret-id gss/subscribe --region us-east-2 --profile ground-state \
  --query SecretString --output text \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['POSTMARK_TOKEN'])")
```

## Safety guards

The CLI refuses to send if:

- The `{{{ pm:unsubscribe }}}` placeholder is absent from either the HTML or plain-text
  body. Postmark Broadcast requires this for CAN-SPAM / GDPR compliance.
- There are zero confirmed recipients in DynamoDB.

These guards apply even when `--send` is passed.

## Postmark Broadcast stream

The Postmark Message Stream must be of type `Broadcasts` and must have
Postmark-managed unsubscribes enabled. This ensures that unsubscribe requests are
handled automatically by Postmark and the `{{{ pm:unsubscribe }}}` macro resolves to a
working one-click link.

Postmark recommends warming a brand-new broadcast stream gradually (no more than
20,000 messages per hour in the first 12 hours of its life). At the current list size
this limit is not a concern.

## Bounce / complaint / unsubscribe feedback loop

Bounces, spam complaints, and unsubscribe events from Postmark are written back to
the DynamoDB subscribers table automatically via the existing `/postmark-webhook`
Lambda endpoint. Suppressed addresses will not appear in future recipient lists.

## Source modules

| Module | Responsibility |
|---|---|
| `src/issue-email.mjs` | `fetchIssue` (Sanity GROQ), `renderIssueEmail` (HTML + text) |
| `src/recipients.mjs` | `listConfirmedRecipients` (DynamoDB scan) |
| `src/postmark.mjs` | `sendIssue` (Postmark Batch Messages API) |
| `src/chunk.mjs` | Array chunking helper used by the send layer |
