/*
 * Operator CLI — send one PUBLISHED Signal issue to confirmed subscribers via
 * Postmark Broadcast. Dry-run by default; pass --send to actually send.
 *
 *   node send-issue.mjs <slug>              # dry run: summary + rendered preview files
 *   node send-issue.mjs <slug> --send       # real batch send (typed confirmation)
 *   node send-issue.mjs <slug> --send --yes # scripted send, no prompt
 *
 * Env (no secrets in argv): TABLE_NAME, SANITY_PROJECT_ID, SANITY_DATASET,
 *   POSTMARK_TOKEN + FROM_ADDRESS (send mode), AWS_REGION + AWS_PROFILE
 *   (enforced — an unpinned scan can silently target the wrong account's
 *   table). SITE_URL defaults to https://groundstatesociety.com.
 *
 * Exit codes: 0 clean send (or dry run) · 1 refused / invalid input /
 *   per-recipient failures · 2 aborted mid-run (partial tally printed —
 *   earlier batches WERE delivered; the count still unconfirmed is shown).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  fetchIssue as realFetchIssue,
  renderIssueEmail as realRenderIssueEmail,
  UNSUBSCRIBE_PLACEHOLDER,
} from './src/issue-email.mjs'
import { listConfirmedRecipients as realListConfirmedRecipients } from './src/recipients.mjs'
import { sendIssue as realSendIssue } from './src/postmark.mjs'

// Same rule scripts/fetch-issues.mjs enforces (fleet convention): the slug is
// CMS-sourced input and it reaches a URL and the email body.
const SLUG_RE = /^[a-z0-9-]+$/

// A live send must be read before it is fired: the operator types the exact
// recipient count from the summary above the prompt.
async function confirmInteractive(count) {
  const { createInterface } = await import('node:readline/promises')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(
      `Type the recipient count (${count}) to send to the FULL list: `,
    )
    return answer.trim() === String(count)
  } finally {
    rl.close()
  }
}

// Dry-run artifact: the operator's first look at the rendered issue must not
// be the live send itself.
async function writePreviewFiles(slug, html, text) {
  const dir = fileURLToPath(new URL('preview/', import.meta.url))
  await mkdir(dir, { recursive: true })
  const paths = [`${dir}${slug}.html`, `${dir}${slug}.txt`]
  await writeFile(paths[0], html)
  await writeFile(paths[1], text)
  return paths
}

// Every required name checked up front, reported together — never one missing
// variable at a time, three network calls in. AWS pinning is deliberate: the
// README has always required it, the code now enforces it.
function missingEnv(env, doSend) {
  const required = ['SANITY_PROJECT_ID', 'TABLE_NAME', 'AWS_REGION', 'AWS_PROFILE']
  if (doSend) required.push('POSTMARK_TOKEN', 'FROM_ADDRESS')
  return required.filter((name) => !env[name])
}

/* The injectable entry point (the fleet's makeHandler pattern): returns an
   exit code, never calls process.exit — tests drive every guard through
   `deps` without touching the network, stdin, or the filesystem. */
export async function run({ argv, env, deps = {} }) {
  const d = {
    fetchIssue: realFetchIssue,
    renderIssueEmail: realRenderIssueEmail,
    listConfirmedRecipients: realListConfirmedRecipients,
    sendIssue: realSendIssue,
    confirm: confirmInteractive,
    writePreview: writePreviewFiles,
    ...deps,
  }
  const args = argv.slice(2)
  const slug = args[0]
  const doSend = args.includes('--send')
  const skipConfirm = args.includes('--yes')

  if (!slug || slug.startsWith('--')) {
    console.error('Usage: node send-issue.mjs <slug> [--send] [--yes]')
    return 1
  }
  if (!SLUG_RE.test(slug)) {
    console.error(`Invalid slug ${JSON.stringify(slug)} — expected ${SLUG_RE}`)
    return 1
  }
  const missing = missingEnv(env, doSend)
  if (missing.length) {
    console.error(`Missing env: ${missing.join(', ')}`)
    return 1
  }
  // Presence is not enough: a shell-wide AWS_PROFILE default (e.g. personal-dev)
  // satisfies it. The subscribers table lives only in the GSS account
  // (659220242594), reached via the ground-state profile.
  if (env.AWS_PROFILE !== 'ground-state') {
    console.error(`AWS_PROFILE must be ground-state (GSS account 659220242594); got ${JSON.stringify(env.AWS_PROFILE)}`)
    return 1
  }

  const siteUrl = env.SITE_URL || 'https://groundstatesociety.com'
  const issue = await d.fetchIssue({
    slug,
    projectId: env.SANITY_PROJECT_ID,
    dataset: env.SANITY_DATASET || 'production',
  })
  if (!issue) {
    console.error(`No PUBLISHED issue with slug "${slug}"`)
    return 1
  }

  const { subject, html, text, fromName, unknownTypes } = d.renderIssueEmail({ issue, siteUrl })
  const recipients = await d.listConfirmedRecipients(env.TABLE_NAME)

  const hasUnsub =
    html.includes(UNSUBSCRIBE_PLACEHOLDER) && text.includes(UNSUBSCRIBE_PLACEHOLDER)
  console.log(
    JSON.stringify(
      {
        slug,
        subject,
        recipients: recipients.length,
        sample: recipients.slice(0, 3),
        unsubscribePlaceholder: hasUnsub,
        unknownTypes: unknownTypes ?? [],
        mode: doSend ? 'SEND' : 'DRY-RUN',
      },
      null,
      2,
    ),
  )
  if (unknownTypes?.length) {
    console.error(
      `WARNING: unknown Portable Text type(s) dropped from the rendered email: ${unknownTypes.join(', ')}`,
    )
  }

  if (!hasUnsub) {
    console.error('Refusing to send: unsubscribe placeholder missing')
    return 1
  }
  if (recipients.length === 0) {
    console.error('No confirmed recipients.')
    return 1
  }

  if (!doSend) {
    const paths = await d.writePreview(slug, html, text)
    console.log(`Preview written:\n  ${paths.join('\n  ')}`)
    console.log('Dry run — nothing sent. Re-run with --send to send.')
    return 0
  }

  if (!skipConfirm) {
    const ok = await d.confirm(recipients.length)
    if (!ok) {
      console.error('Confirmation failed — nothing sent.')
      return 1
    }
  }

  const result = await d.sendIssue({
    recipients,
    subject,
    html,
    text,
    fromName,
    fromAddress: env.FROM_ADDRESS,
    token: env.POSTMARK_TOKEN,
  })
  console.log(
    JSON.stringify(
      { sent: result.sent, failed: result.failed.length, aborted: result.aborted ?? null },
      null,
      2,
    ),
  )
  if (result.failed.length) console.error(JSON.stringify({ failures: result.failed }, null, 2))
  if (result.aborted) {
    console.error(
      `ABORTED at batch ${result.aborted.atBatch}: ${result.aborted.message} — ` +
        `${result.aborted.remaining} recipient(s) unconfirmed (incl. the failed batch). ` +
        `${result.sent} confirmed sent before the abort.`,
    )
    return 2
  }
  return result.failed.length ? 1 : 0
}

// Shim: execute only when invoked directly — importing this module (tests)
// must never fire a send.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ argv: process.argv, env: process.env })
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
