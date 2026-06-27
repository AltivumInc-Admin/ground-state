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
