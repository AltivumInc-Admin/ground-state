# Feature 11 batch — Signal broadcast CLI hardening (plan, 2026-07-03)

Source: Category D audit findings for feature 11 in `docs/feature-optimization.md`.
Timing: BEFORE the first Signal send-day — every gap here bites exactly once, in
front of the full list. Remaining: 6 Mediums + 5 Lows (the fetch timeouts shipped
in #45). The CLI is never deployed, so this batch is code-only: no stack rollout.

## Objective

Make the one tool that emails the whole list safe to operate under send-day
pressure: a live send requires typed confirmation; the operator can eyeball the
rendered email before sending; a mid-run failure reports exactly who was reached
and exits non-zero; Sanity-derived values can't inject into the email HTML; and
the entry-point guards — the only untested entry logic in the fleet — get the
same injection-seam treatment as every Lambda.

## Prerequisites

- No new runtime dependencies (`node:readline/promises`, `node:fs` are built-in).
- Read first: `backend/broadcast/send-issue.mjs`, `src/{issue-email,postmark,recipients,chunk}.mjs`,
  `test/*.test.mjs`, `README.md`, and both dependency manifests (root +
  `backend/broadcast/package.json`).
- For the final live check: the operator env (`TABLE_NAME`, `SANITY_PROJECT_ID`,
  AWS profile) to run one real DRY-RUN against production — read-only, sends nothing.

## Step-by-step

1. [M/Consistency] Injection seam + entry tests (the structural piece — do first)
   1.1. Refactor `send-issue.mjs`: extract `main()` into an exported
        `run({ argv, env, deps })` that RETURNS an exit code instead of calling
        `process.exit`, with `deps = { fetchIssue, listConfirmedRecipients,
        sendIssue, confirm }` defaulting to the real modules — the fleet's
        `makeHandler({ store, email })` pattern. The file's tail becomes a thin
        shim: `process.exit(await run({ argv: process.argv, env: process.env, deps }))`
        guarded so importing the module for tests never triggers it (check
        `import.meta.url` against `process.argv[1]`, the standard Node idiom).
   1.2. `req()` moves inside `run` and reads from the injected `env`; it throws
        a `MissingEnv` error the shim maps to exit 1 (no `process.exit` in lib code).
2. [M/Consistency + L] Fail-fast env incl. AWS pinning: `run` validates ALL
   required env up front — `SANITY_PROJECT_ID`, `TABLE_NAME`, `AWS_REGION`,
   `AWS_PROFILE` always; `POSTMARK_TOKEN`, `FROM_ADDRESS` additionally in
   `--send` mode — before any network call, listing every missing name at once.
   (Closes both the pinning Medium — the README already declares
   AWS_REGION/AWS_PROFILE required, the code just never enforced it — and the
   lazy-validation Low.) Comment why: an unpinned scan can silently target the
   wrong account's table.
3. [M+L/Security] Escape the last two sinks + validate the slug at entry
   3.1. `issue-email.mjs`: `src="${escapeHtml(value.url)}"` (the one interpolation
        that skips the renderer's own convention) and `href/`text for `webUrl`
        → `escapeHtml(webUrl)` at both sinks.
   3.2. `run` rejects a slug failing `/^[a-z0-9-]+$/` (the same rule
        `scripts/fetch-issues.mjs` applies — fleet convention) before any fetch;
        webUrl construction is then structurally safe too.
4. [M/OpUX] Dry-run preview + loud unknown Portable Text types
   4.1. In dry-run, write the already-rendered artifacts to
        `backend/broadcast/preview/<slug>.html` and `.txt` (dir anchored via
        `new URL('preview/', import.meta.url)`, created on demand) and print the
        paths — the operator's first look at the rendered issue must not be the
        live send. Add `backend/broadcast/preview/` to `.gitignore`.
   4.2. Pass `onMissingComponent` to `toHTML` (supported by @portabletext/to-html):
        collect unknown type/mark names instead of the default silent drop, and
        surface them in the summary JSON as `unknownTypes: [...]` with a stderr
        warning. Refuse nothing — visibility, not new gating.
5. [M/OpUX] Confirmation gate on live sends: in `--send` mode, after the summary
   prints, `deps.confirm(recipients.length)` must resolve true — the default
   implementation (node:readline/promises) requires typing the exact recipient
   count; `--yes` skips it (scripted sends). Wrong entry → exit 1, nothing sent.
6. [M/Resilience] Partial-send accounting + honest exit codes
   6.1. `postmark.mjs` `sendIssue`: log one structured line per batch
        (`{at:'batch', index, size, sentSoFar}`) before the POST; on a batch
        failure, catch and RETURN `{ sent, failed, aborted: { atBatch, remaining,
        message } }` instead of throwing away the tally 1..N-1.
   6.2. `send-issue.mjs`: print the full tally; exit 2 when `aborted` (with the
        exact remaining count — the resume decision needs it), exit 1 when any
        per-recipient failure (`failed.length > 0`; today this exits 0), exit 0
        only on a clean sweep. Document the exit-code contract in the README.
   6.3. Update `postmark.test.mjs` to the new contract: the non-ok test asserts
        the returned `aborted` tally instead of a rejection, and the #45
        TimeoutError test asserts the timeout surfaces inside `aborted.message`
        with `sent` preserved (deliberate contract change, noted in the PR).
7. [L/Cleaner] `UNSUBSCRIBE_PLACEHOLDER` exported from `issue-email.mjs`; the
   renderer's two bodies and `send-issue.mjs`'s compliance check all reference it
   (the CAN-SPAM-critical literal currently lives in 4 places).
8. [L/Consistency] Align the dual manifests: broadcast's
   `@portabletext/to-html ^2.0.14` → `^2.0.17` and `@sanity/client 7.23.0` →
   `^7.23.0` to match the root (CI resolves the root's versions; the operator's
   CLI run resolves broadcast's — drift means testing one thing and running
   another). `cd backend/broadcast && npm install` refreshes its lockfile.
9. [L/Resilience] Pagination test: `recipients.test.mjs` gains a two-page mock
   (first response carries `LastEvaluatedKey`) asserting all emails collected
   and `ExclusiveStartKey` threaded — silent truncation would under-send.
10. [L/Security] README token command → extraction via command substitution
    (`--query SecretString --output text` piped to a one-liner pulling only
    `POSTMARK_TOKEN`), so the multi-key secret blob never lands in scrollback;
    same pattern the gss/apply creation used. Also document: preview files,
    the confirmation gate + `--yes`, and the exit-code contract.
11. Entry tests (with the step-1 seam), `backend/broadcast/test/run.test.mjs`:
    missing env lists all names (exit 1); bad slug rejected; no published issue
    → exit 1; unsubscribe-placeholder missing → exit 1 even with `--send`;
    zero recipients → exit 1; dry-run → sendIssue NOT called, preview files
    written, exit 0; `--send` without confirmation → nothing sent, exit 1;
    `--send` confirmed → sendIssue called, clean exit 0; per-recipient failures
    → exit 1; aborted mid-run → exit 2 with tally printed.
12. Gate + live check: `npm test` green → PR → CI → user merges. No deploy (CLI
    only). Then ONE real dry-run against production
    (`node backend/broadcast/send-issue.mjs <slug-or-probe>` with real env):
    read-only Scan, sends nothing — proves env fail-fast, the guards, and (once
    an issue exists) the preview files, end to end.

## File & code changes

| Action | File | Change |
|---|---|---|
| Modify | `backend/broadcast/send-issue.mjs` | run() seam, fail-fast env, slug guard, confirmation gate, preview writing, exit-code contract |
| Modify | `backend/broadcast/src/postmark.mjs` | per-batch logs; aborted-tally return contract |
| Modify | `backend/broadcast/src/issue-email.mjs` | escape url/webUrl sinks; UNSUBSCRIBE_PLACEHOLDER export; onMissingComponent |
| Modify | `backend/broadcast/package.json` (+lock) | manifest alignment |
| Modify | `backend/broadcast/README.md` | token extraction, preview, gate + --yes, exit codes, env table |
| Modify | `backend/broadcast/test/postmark.test.mjs` | new sendIssue contract (incl. #45 test update) |
| Modify | `backend/broadcast/test/recipients.test.mjs` | pagination test |
| Create | `backend/broadcast/test/run.test.mjs` | the 10 entry-guard tests |
| Modify | `.gitignore` | `backend/broadcast/preview/` |

## Testing & validation

Unit: the run.test.mjs suite above + postmark contract tests + pagination test +
escaping assertions in issue-email.test.mjs (img src and webUrl with hostile
values). Manual: the production dry-run in step 12. Rollback: revert commit —
nothing deployed, nothing to unwind.

## Risk & mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| sendIssue contract change breaks an unseen caller | Low | Med | Grep confirms send-issue.mjs is the only caller; tests pin both sides |
| Confirmation gate blocks a legitimate scripted send | Low | Low | `--yes` documented; interactive is the safe default for a solo operator |
| import.meta shim misfires (runs main on import) | Low | Med | The argv[1] guard is the standard idiom; run.test.mjs importing the module IS the regression test |
| Preview dir writes fail on a read-only checkout | Very low | Low | mkdir recursive + a clear error naming the path |

## Dependencies & order

Step 1 first (everything else lands inside the seam). 3–10 in any order after;
6.3 with 6.1. Step 12 last. No interaction with features 9/E/F work.

## Estimated effort

Complexity: Medium. Time: 3–5 hours. Files: 1 created, 8 modified. No deploy.

# MISSION BRIEF

Overview: one code-only PR turns the full-list email tool from
works-when-everything-works into safe-under-pressure, with its guards tested
for the first time.

Execution order: seam (1) → env/slug/escaping (2–3) → operator UX (4–5) →
accounting (6) → tail (7–10) → tests (11) → PR → merge → production dry-run (12).

Decision points:
- Confirmation input = the recipient count (forces reading the summary). Typing
  the slug instead is the alternative if you prefer.
- Exit-code contract (0 clean / 1 failures-or-refused / 2 aborted mid-run) —
  the resume decision keys off it.
- sendIssue's throw→return contract change updates one #45 test (noted in PR).

Total estimated effort: 3–5 hours.
