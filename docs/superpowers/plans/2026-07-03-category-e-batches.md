# Category E execution — four batches (plan, 2026-07-03)

Source: Category E audit findings (features 12/13) in `docs/feature-optimization.md`.
Timing: all four land best BEFORE the first issue publishes — the email-contract
gaps in particular are irrevocable once a broadcast goes out.

---

## Plan 1 — Email-contract batch (one `issue-email.mjs` pass)

### Objective
The Studio schema allows lists and the inline `code` mark; the web renderer styles
both; the email renderer styles neither (library defaults render them unstyled and
the #48 unknown-type warning can't fire for known constructs). Same pass: email
images stop shipping full-resolution originals, and the email link serializer gains
the web's protocol-allowlist safety. After this, every schema-allowed construct
renders deliberately in BOTH consumers.

### Prerequisites
- Read: `backend/broadcast/src/issue-email.mjs` (serializers + FONT/inline-style
  conventions), `src/components/IssueBody.jsx` (the web contract to mirror:
  `classifyLink` allowlist, `sizedSanityUrl`), `studio/schemaTypes/objects/blockContent.ts`
  (the authoritative list of allowed styles/marks/lists).
- No new dependencies; @portabletext/to-html already supports `list`/`listItem`
  serializer keys.

### Step-by-step
1. Lists: extend the `components` object with email-safe inline-styled serializers —
   `list: { bullet: ..., number: ... }` (`<ul>`/`<ol>` with margin + padding-left
   matching the paragraph rhythm) and `listItem: { bullet: ..., number: ... }`
   (`<li>` with the `normal` paragraph font/color). Match the existing FONT const
   and #432d16 body color.
2. Code mark: `marks.code` → `<code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;background:#f1f1f6;border-radius:4px;padding:1px 5px;color:#08080a;">`
   — mirrors the web's `.issue-body code` treatment in email-safe inline styles.
3. Image sizing: add a local `sizedSanityUrl(url, width)` (copied from
   IssueBody.jsx:25-28 with a comment naming the source — cross-package
   independence is the house pattern) and use it in the `pteImage` serializer:
   `src="${escapeHtml(sizedSanityUrl(value.url, 1120))}"` (580px column × 2 for
   retina; `auto=format` keeps broad email-client compatibility via content
   negotiation).
4. Link allowlist parity: replace `value?.href ?? '#'` with a classify step
   mirroring the web's semantics for the email context — http(s)/mailto/tel render
   as anchors; anything else (empty, `javascript:`, `data:`, `//host`, bare
   relative) renders plain children (an in-app `/path` is dead in an email client
   anyway; authors get absolute URLs via Plan 2's tightened validation).
5. Plain-text bodies: numbered-list items in `blocksToText` currently render as
   `- item` like bullets — prefix `n.` using the block's position within its list
   run (small, optional polish; skip if the run-grouping complicates).
6. Tests (`backend/broadcast/test/issue-email.test.mjs`): bullet + numbered list
   → styled `<ul>`/`<ol>`/`<li>`; `code` mark → `<code>`; `javascript:` and empty
   hrefs → plain children (no anchor); image src carries `?w=1120&auto=format`;
   existing tests untouched.

### File & code changes
| Action | File | Change |
|---|---|---|
| Modify | `backend/broadcast/src/issue-email.mjs` | list/listItem/code serializers; sizedSanityUrl; link classify |
| Modify | `backend/broadcast/test/issue-email.test.mjs` | contract tests above |

### Testing & validation
`npm test`; then a real dry-run once a draft issue with a list + code mark exists —
the #48 preview files are exactly the eyeball surface for this. Rollback: revert.

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Inline list styles render inconsistently across email clients | Med | Low | Margin/padding-left on both ul/ol + li is the max-compatibility pattern already used for paragraphs |
| Link tightening drops a construct an author relied on | Low | Low | Only non-absolute/unsafe hrefs change (to plain text — currently they ship dead `#`) |

### Effort
Complexity: Low. Time: 1–2 h. Files: 2.

---

## Plan 2 — Studio author-time batch (schema only + studio deploy)

### Objective
Close the author-time gaps that currently surface only after a build or a send:
the status/Publish double gate and the public-dataset truth become legible at the
point of decision; an empty link href can no longer publish; a missing alt can no
longer be dismissed; publishedAt explains what it drives.

### Prerequisites
- Read: `studio/schemaTypes/documents/issue.ts`, `objects/{blockContent,pteImage}.ts`.
- Studio deploy access: the hosted studio (`groundstate.sanity.studio`,
  `studio/sanity.cli.ts`) redeploys via `npx sanity deploy` from `studio/` —
  requires a logged-in Sanity session (OPERATOR step: `npx sanity login` if
  needed; suggest running it as `! cd studio && npx sanity deploy`).

### Step-by-step
1. `issue.ts` status field — title `'Visibility (site + email)'` and description:
   "Gates the website build and the email send ONLY. Both also require the
   document to be published with Sanity's Publish button — Draft here hides a
   natively-published issue from everything. It does NOT make it private: the
   dataset is public, so anything Published with the button is world-readable
   regardless of this setting." (Covers both the double-gate and the
   trust-boundary findings in one field description.)
2. `issue.ts` publishedAt — description: "The public issue date: shown on the
   issue page and in the email header, and orders the archive. Pre-filled when
   the draft was created — update it before publishing if drafting spanned days."
3. `blockContent.ts` link href — `validation: (r) => r.required().uri({ scheme:
   ['http', 'https', 'mailto', 'tel'] })` (required-ness is the deadline-biting
   fix; `tel` reconciles with the web classifier; keep relative paths excluded —
   they are dead in email, and email now falls back safely via Plan 1).
4. `pteImage.ts` alt — promote from `.warning(...)` to a hard error:
   `validation: (r) => r.required().error('Alt text is required — screen readers
   and image-blocking email clients render it.')`
5. Verify locally (`cd studio && npx tsc --noEmit` if configured, else
   `npm run build`-equivalent `sanity build --no-minify` smoke) → PR → merge →
   OPERATOR: `cd studio && npx sanity deploy`.

### File & code changes
| Action | File | Change |
|---|---|---|
| Modify | `studio/schemaTypes/documents/issue.ts` | status + publishedAt descriptions/title |
| Modify | `studio/schemaTypes/objects/blockContent.ts` | link href required + tel |
| Modify | `studio/schemaTypes/objects/pteImage.ts` | alt to error level |

### Testing & validation
Schema files are declarative — validation is the studio compile + a manual pass in
the deployed Studio: create a test draft, confirm the new descriptions render, an
empty link blocks publish, a missing alt blocks publish. Delete the test draft.
Rollback: revert + redeploy the studio.

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hard-required alt/href blocks a legitimate first-issue publish flow | Low | Low | Both are one-field fixes at author time — exactly the point |
| Studio deploy forgotten → schema drift between repo and hosted studio | Med | Med | The deploy step is explicit in the PR body + debrief |

### Effort
Complexity: Low. Time: ~1 h + the studio deploy. Files: 3.

---

## Plan 3 — fetch-issues batch (guard, logs, single-owner seo, tests)

### Objective
Close the guard's blind spot (a configured fetch returning zero issues currently
green-builds a delisted archive), make the one-line build log diagnosable, warn on
kept-but-degraded issues, and make `normalizeIssues` the single owner of the seo
fallback rule that is currently stated four times with two semantics.

### Prerequisites
- CRITICAL ORDER-OF-OPERATIONS: the archive is empty TODAY, so the extended guard
  would fail the next production build. BEFORE merging, set
  `GSS_ALLOW_EMPTY_ISSUES=1` in the Amplify console env (documented as
  "pre-first-issue: remove at first publish"). Removing that flag at first-issue
  publish re-arms the guard.
- Read: `scripts/fetch-issues.mjs` (whole), `scripts/fetch-issues.test.mjs`,
  `scripts/prerender.mjs:86-98`, `src/pages/SignalIssue.jsx:13-17`.

### Step-by-step
1. Guard extension: extract an exported pure helper
   `guardEmptyIssues(issues, env)` — throws the refusal (same message style as
   #18, naming the flag) when `issues.length === 0 && env.GSS_ALLOW_EMPTY_ISSUES
   !== '1'`; warns (existing style) when empty-but-allowed. Call it in `main()`
   after `normalizeIssues`. Being exported + pure, it is directly testable.
2. Log context: before the fetch, `console.log('fetch-issues: querying
   <projectId>/<dataset> (token: present|absent)')` — never the token value;
   after, `wrote N of M fetched (dropped D)` where M is `raw.length` and D the
   difference (makes a wrong-dataset or normalization-drop build diagnosable from
   the Amplify log alone).
3. Degraded-issue warns in `normalizeIssues`: when a KEPT issue has an
   empty/missing `body`, `console.warn('fetch-issues: issue "<slug>" kept with an
   empty body — the live page will render hollow')` (reuses the existing
   drop-warn style at :46-49). Same for an empty title.
4. Slug uniqueness: in `normalizeIssues`, drop any second occurrence of a slug
   (keep the first — raw order is publishedAt desc) with a warn; duplicates
   currently corrupt the prerender output path and sitemap.
5. Single-owner seo fallback (the four sites, two semantics — GROQ `coalesce` +
   `??` in this file, `||` re-fallbacks in consumers):
   5.1. Delete the GROQ `coalesce(...)` projections (`fetch-issues.mjs:21-22`) —
        project raw `"title": seo.title, "description": seo.description`;
        `normalizeIssues`' existing `??` chain (:61-62) becomes the one owner.
        Semantics note: `??` treats an empty-string seo.title as authored (kept),
        `coalesce`/`||` treat it as absent — the `??` semantic wins; document it
        in a comment.
   5.2. Consumers trust the contract: `scripts/prerender.mjs:88-89,97` →
        `issue.seo.title` / `issue.seo.description` (drop `|| issue.title` etc.);
        `src/pages/SignalIssue.jsx:14-15` → same (keep the `issue ?` ternary for
        the not-found path).
   5.3. Contract test: normalize output always carries string `seo.title`/
        `seo.description` (authored wins, fallback otherwise) — extend the
        existing fetch-issues tests; a homepage-head drift-style guard is
        already in place for consumers via the prerender expect checks.
6. Docblock: rewrite the module header (it still documents the pre-#18 "writes an
   empty list so the build still succeeds" behavior) to describe the guard +
   flag + new zero-issue coverage.
7. Tests: `guardEmptyIssues` both branches; kept-but-degraded warn fires; slug
   dedupe keeps first + warns; seo authored-vs-fallback cases; existing 3 tests
   updated where the GROQ shape changed (raw fixtures no longer pre-coalesced).

### File & code changes
| Action | File | Change |
|---|---|---|
| Modify | `scripts/fetch-issues.mjs` | guard helper + call; log context; degraded warns; slug dedupe; GROQ de-coalesce; docblock |
| Modify | `scripts/fetch-issues.test.mjs` | new + updated tests |
| Modify | `scripts/prerender.mjs` | trust seo contract (3 lines) |
| Modify | `src/pages/SignalIssue.jsx` | trust seo contract (2 lines) |

### Testing & validation
`npm test` + `npm run test:fe` + `GSS_ALLOW_EMPTY_ISSUES=1 npm run build` (must
warn-and-pass) and a build WITHOUT the flag (must fail with the new message —
that failing build is the acceptance test). Post-merge: confirm the Amplify env
flag is set BEFORE the merge lands (prerequisite), watch the next Amplify build
log for the new context lines. Rollback: revert; the env flag is harmless to leave.

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Merge lands before the Amplify flag is set → production build fails | Med | High (blocked deploys) | The flag-set is the plan's explicit prerequisite; verify via Amplify console before merging |
| Consumers trusted the OLD `\|\|` semantics for empty-string seo fields | Low | Low | Studio requires title/excerpt, so authored-empty is only reachable via raw API writes; semantics documented |
| Flag left set after first publish (guard never re-arms) | Med | Med | Recorded as the flip action in the docs entry + first-issue checklist |

### Effort
Complexity: Medium. Time: 2–3 h. Files: 4.

---

## Plan 4 — Low tail (audit fix, CI compile gate, projectId dedup, token parity)

### Objective
Clear the four remaining Lows: the two transitive Studio advisories, the
merges-green-breaks-at-deploy Studio typecheck gap, the twice-hardcoded
projectId/dataset, and the `SANITY_READ_TOKEN` contingency that reaches only one
of the two GROQ consumers.

### Step-by-step
1. `cd studio && npm audit fix && npm audit --audit-level=high` (the finding
   verified the chains clear non-breaking; confirm lockfile-only diff) — then
   `npx tsc --noEmit` (or the studio build smoke) to prove nothing moved.
2. CI compile gate: add a parallel `studio` job to `.github/workflows/ci.yml` —
   `npm ci` in `studio/` + `npx tsc --noEmit` (verify `studio/tsconfig.json`
   exists at implementation; if absent, `sanity build --no-minify` is the
   fallback gate). SHA-pin any new action steps per the #22 convention; add
   `timeout-minutes`.
3. projectId dedup: create `studio/env.ts` exporting
   `projectId = 'pe7zq1it'` / `dataset = 'production'`; import in both
   `sanity.config.ts` and `sanity.cli.ts` (comment: the id is public by design;
   the dedup is for drift, not secrecy).
4. Token parity: `backend/broadcast/src/issue-email.mjs` `fetchIssue` gains
   `token: process.env.SANITY_READ_TOKEN || undefined` in its `createClient`
   config, mirroring `fetch-issues.mjs:103` — the documented private-dataset
   contingency then covers both GROQ consumers.
5. Gate: root `npm test` (broadcast tests cover fetchIssue config shape loosely);
   CI green incl. the new studio job.

### File & code changes
| Action | File | Change |
|---|---|---|
| Modify | `studio/package.json` + lockfile | audit fix |
| Create | `studio/env.ts` | shared projectId/dataset |
| Modify | `studio/sanity.config.ts`, `studio/sanity.cli.ts` | import shared env |
| Modify | `.github/workflows/ci.yml` | studio typecheck job |
| Modify | `backend/broadcast/src/issue-email.mjs` | read-token parity |

### Risk & mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| audit fix bumps something breaking despite the non-breaking verification | Low | Med | tsc/build smoke in the same commit; revert is lockfile-only |
| New CI job slows every PR | Low | Low | Parallel job; studio npm ci is cached by actions/setup-node if configured |

### Effort
Complexity: Low. Time: 1–2 h. Files: ~6.

---

# MISSION BRIEF

Overview: four small batches close all 19 Category E findings — the email
renderer catches up to the schema contract, the Studio tells authors the truth
at the point of decision, and the build pipeline stops being able to silently
delist or hollow out the archive.

Execution order:
  1. Plan 1 (email contract) — the irrevocable-send risk, and Plan 2's
     validation tightening assumes email falls back safely.
  2. Plan 2 (Studio) — includes the operator `sanity deploy` step.
  3. Plan 3 (fetch-issues) — ONLY after setting GSS_ALLOW_EMPTY_ISSUES=1 in
     Amplify (else the next production build fails by design).
  4. Plan 4 (low tail) — any time; the CI job is the only cross-cutting piece.
  Plans 1+4's broadcast edits and 2's studio edits can share one PR if desired;
  3 is cleanest as its own PR because of the env-flag choreography.

Decision points:
  - Plan 3's guard intentionally makes "no issues" a failing production build —
    accept the temporary Amplify flag until first publish (recommended), or
    defer Plan 3 step 1 until after the first issue ships.
  - Plan 1 step 5 (numbered-list text bodies) is optional polish.
  - Plan 2's studio deploy needs your Sanity login if my session lacks one.

Total estimated effort: 5–8 hours across 2–3 PRs + one studio deploy.
