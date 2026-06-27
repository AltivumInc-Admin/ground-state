# broadcast

Operator tooling for sending Signal newsletter issues to confirmed subscribers via
Postmark Broadcast.

## Purpose

`send-issue.mjs` fetches a published Sanity issue, renders its HTML and plain-text
emails, pulls the confirmed-subscriber list from DynamoDB, and (optionally) fires a
batch send through Postmark. It is the final step in the Signal broadcast pipeline.

## Usage

```bash
# Dry run — prints subject, recipient count, a 3-address sample, and whether the
# unsubscribe placeholder is present. Nothing is sent.
node send-issue.mjs <slug>

# Real send — performs the actual batch delivery via Postmark Broadcast.
node send-issue.mjs <slug> --send
```

The slug must match a `status=published` document in Sanity. Drafts and unpublished
issues are rejected.

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

`POSTMARK_TOKEN` lives in AWS Secrets Manager under `gss/subscribe`. Retrieve it with:

```bash
aws secretsmanager get-secret-value \
  --secret-id gss/subscribe \
  --region us-east-2 \
  --profile ground-state
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
