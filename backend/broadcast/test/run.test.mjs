import { test } from 'node:test'
import assert from 'node:assert/strict'
import { run } from '../send-issue.mjs'

/* The CLI's safety guards, tested through the injected-deps seam. Importing
   send-issue.mjs must never execute a send — the argv[1] shim guard is itself
   under test by the fact this file runs at all. */

const ENV = {
  SANITY_PROJECT_ID: 'proj',
  TABLE_NAME: 'tbl',
  AWS_REGION: 'us-east-2',
  AWS_PROFILE: 'ground-state',
  POSTMARK_TOKEN: 'tok',
  FROM_ADDRESS: 'no-reply@x.co',
  SITE_URL: 'https://x.co',
}
const ISSUE = { slug: 'first-issue', title: 'T', publishedAt: '2026-07-01T00:00:00Z', body: [] }
const RENDERED = {
  subject: 'T',
  html: 'h {{{ pm:unsubscribe }}}',
  text: 't {{{ pm:unsubscribe }}}',
  fromName: 'GSS',
  unknownTypes: [],
}
const argv = (...a) => ['node', 'send-issue.mjs', ...a]

function fakes(overrides = {}) {
  const calls = { sends: [], previews: [], confirms: [] }
  const deps = {
    fetchIssue: async () => ISSUE,
    renderIssueEmail: () => RENDERED,
    listConfirmedRecipients: async () => ['a@b.co', 'c@d.co'],
    sendIssue: async (args) => {
      calls.sends.push(args)
      return { sent: 2, failed: [] }
    },
    confirm: async (n) => {
      calls.confirms.push(n)
      return true
    },
    writePreview: async (slug) => {
      calls.previews.push(slug)
      return ['/tmp/p.html', '/tmp/p.txt']
    },
    ...overrides,
  }
  return { deps, calls }
}

const quiet = (t) => {
  t.mock.method(console, 'log', () => {})
  return t.mock.method(console, 'error', () => {})
}

test('missing env is reported all at once, before any network call', async (t) => {
  const err = quiet(t)
  const { deps, calls } = fakes({ fetchIssue: async () => { throw new Error('must not be called') } })
  const code = await run({ argv: argv('first-issue', '--send'), env: {}, deps })
  assert.equal(code, 1)
  const msg = err.mock.calls[0].arguments[0]
  for (const name of ['SANITY_PROJECT_ID', 'TABLE_NAME', 'AWS_REGION', 'AWS_PROFILE', 'POSTMARK_TOKEN', 'FROM_ADDRESS']) {
    assert.match(msg, new RegExp(name), name)
  }
  assert.equal(calls.sends.length, 0)
})

test('POSTMARK_TOKEN/FROM_ADDRESS are only required in --send mode', async (t) => {
  quiet(t)
  const { deps } = fakes()
  const env = { ...ENV }
  delete env.POSTMARK_TOKEN
  delete env.FROM_ADDRESS
  const code = await run({ argv: argv('first-issue'), env, deps })
  assert.equal(code, 0) // dry run fine without send-mode secrets
})

test('no slug prints usage and exits 1', async (t) => {
  quiet(t)
  const { deps } = fakes()
  assert.equal(await run({ argv: argv(), env: ENV, deps }), 1)
  assert.equal(await run({ argv: argv('--send'), env: ENV, deps }), 1)
})

test('a slug outside ^[a-z0-9-]+$ is rejected before any fetch', async (t) => {
  quiet(t)
  let fetched = false
  const { deps } = fakes({ fetchIssue: async () => { fetched = true; return ISSUE } })
  const code = await run({ argv: argv('Bad_Slug!'), env: ENV, deps })
  assert.equal(code, 1)
  assert.equal(fetched, false)
})

test('no published issue exits 1', async (t) => {
  quiet(t)
  const { deps } = fakes({ fetchIssue: async () => null })
  assert.equal(await run({ argv: argv('first-issue'), env: ENV, deps }), 1)
})

test('missing unsubscribe placeholder refuses even with --send --yes', async (t) => {
  quiet(t)
  const { deps, calls } = fakes({
    renderIssueEmail: () => ({ ...RENDERED, html: 'no placeholder', text: 'none' }),
  })
  const code = await run({ argv: argv('first-issue', '--send', '--yes'), env: ENV, deps })
  assert.equal(code, 1)
  assert.equal(calls.sends.length, 0)
})

test('zero confirmed recipients refuses', async (t) => {
  quiet(t)
  const { deps, calls } = fakes({ listConfirmedRecipients: async () => [] })
  const code = await run({ argv: argv('first-issue', '--send', '--yes'), env: ENV, deps })
  assert.equal(code, 1)
  assert.equal(calls.sends.length, 0)
})

test('dry run writes the preview, sends nothing, exits 0', async (t) => {
  quiet(t)
  const { deps, calls } = fakes()
  const code = await run({ argv: argv('first-issue'), env: ENV, deps })
  assert.equal(code, 0)
  assert.deepEqual(calls.previews, ['first-issue'])
  assert.equal(calls.sends.length, 0)
  assert.equal(calls.confirms.length, 0)
})

test('unknown Portable Text types surface as a warning in the summary path', async (t) => {
  const err = quiet(t)
  const { deps } = fakes({
    renderIssueEmail: () => ({ ...RENDERED, unknownTypes: ['pteChart'] }),
  })
  await run({ argv: argv('first-issue'), env: ENV, deps })
  const warned = err.mock.calls.some((c) => /pteChart/.test(c.arguments[0]))
  assert.ok(warned)
})

test('a failed confirmation sends nothing and exits 1', async (t) => {
  quiet(t)
  let prompted = 0
  const { deps, calls } = fakes({ confirm: async () => { prompted += 1; return false } })
  const code = await run({ argv: argv('first-issue', '--send'), env: ENV, deps })
  assert.equal(code, 1)
  assert.equal(prompted, 1)
  assert.equal(calls.sends.length, 0)
})

test('a confirmed --send calls sendIssue with the full list and exits 0 clean', async (t) => {
  quiet(t)
  const { deps, calls } = fakes()
  const code = await run({ argv: argv('first-issue', '--send'), env: ENV, deps })
  assert.equal(code, 0)
  assert.deepEqual(calls.confirms, [2]) // prompted with the recipient count
  assert.equal(calls.sends.length, 1)
  assert.deepEqual(calls.sends[0].recipients, ['a@b.co', 'c@d.co'])
})

test('--yes skips the prompt (scripted sends)', async (t) => {
  quiet(t)
  const { deps, calls } = fakes({ confirm: async () => { throw new Error('must not prompt') } })
  const code = await run({ argv: argv('first-issue', '--send', '--yes'), env: ENV, deps })
  assert.equal(code, 0)
  assert.equal(calls.sends.length, 1)
})

test('per-recipient failures exit 1, not 0', async (t) => {
  quiet(t)
  const { deps } = fakes({
    sendIssue: async () => ({ sent: 1, failed: [{ email: 'c@d.co', code: 406, message: 'inactive' }] }),
  })
  const code = await run({ argv: argv('first-issue', '--send', '--yes'), env: ENV, deps })
  assert.equal(code, 1)
})

test('an aborted mid-run send exits 2 with the tally reported', async (t) => {
  const err = quiet(t)
  const { deps } = fakes({
    sendIssue: async () => ({ sent: 500, failed: [], aborted: { atBatch: 2, remaining: 42, message: 'postmark_batch_failed 503' } }),
  })
  const code = await run({ argv: argv('first-issue', '--send', '--yes'), env: ENV, deps })
  assert.equal(code, 2)
  const abortMsg = err.mock.calls.map((c) => c.arguments[0]).find((m) => /ABORTED/.test(m))
  assert.match(abortMsg, /batch 2/)
  assert.match(abortMsg, /42 recipient/)
  assert.match(abortMsg, /500 confirmed sent/)
})
