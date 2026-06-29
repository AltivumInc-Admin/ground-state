# Plan B — Populate the Signal

_Authored 2026-06-29. Source: the 2026-06-28 strategic assessment (highest-leverage items).
Grounded in a file-level recon of `studio/` (Sanity Studio, project `pe7zq1it`), `scripts/fetch-issues.mjs`,
`scripts/prerender.mjs`, `src/pages/{Signal,SignalIssue}.jsx`, `src/components/IssueBody.jsx`,
`amplify.yml`, `customHttp.yml`, `infra/amplify-rewrites.json`, `docs/runbooks/signal-publish-webhook.md`._

## Objective
Turn the empty Signal archive (`src/content/issues.generated.json === []`) into a live, credible free
tier by publishing **2-3 real issues** end-to-end through the existing Sanity → build → prerender
pipeline — anchored on one signature recurring read (e.g., "State of Quantum Funding, for operators").
The code pipeline is already complete; this is authoring + console/env config, plus one optional schema tweak.

## Prerequisites
- Sanity org access to project `pe7zq1it` / dataset `production` (Studio at `groundstate.sanity.studio`);
  Amplify console access + ability to set build env vars.
- Decisions: dataset **public vs private** (private ⇒ read-only `SANITY_READ_TOKEN`); enforce image alt
  text?; add inline-code decorator?; content topic/cadence.
- Review: `studio/schemaTypes/documents/issue.ts` (required fields), `scripts/fetch-issues.mjs` (the
  double publish gate), `docs/runbooks/signal-publish-webhook.md`.
- Assumption: code is complete; the committed `issues.generated.json` stays `[]` in-repo (a prod build
  with `SANITY_PROJECT_ID` overwrites it at deploy).

## Step-by-Step Implementation
1. (Optional code change) Inline code decorator — only if issues need inline `code`: add
   `{ title: 'Code', value: 'code' }` to `marks.decorators` in
   `studio/schemaTypes/objects/blockContent.ts` (the `IssueBody.jsx` serializer already supports it).
2. Confirm Sanity wiring: verify Amplify build env has `SANITY_PROJECT_ID=pe7zq1it` (+
   `SANITY_DATASET=production`) — without it the prod build hard-fails by design; never set
   `GSS_ALLOW_EMPTY_ISSUES=1` in prod. If the dataset is private, create a read-only token and set
   `SANITY_READ_TOKEN` in Amplify. Ensure the Studio is deployed with the current schema
   (`cd studio && npm install && npm run deploy`).
3. Author 2-3 issues in Studio — mind the **double publish gate** each time: fill `title`; generate a
   `slug` matching `^[a-z0-9-]+$`; set `publishedAt`; write `excerpt` (≤200, teaser + default meta
   description); write `body`; optional `seo` (title ≤70, description ≤160, image 1200×630, noIndex).
   **Set `status` = `published` AND click the green Publish button** — both are required.
4. Verify the fetch locally: `SANITY_PROJECT_ID=pe7zq1it SANITY_DATASET=production node scripts/fetch-issues.mjs`
   → confirm `src/content/issues.generated.json` lists the issues correctly.
5. Full build check: `SANITY_PROJECT_ID=pe7zq1it npm run build` → confirm `dist/signal/<slug>.html` exist
   and `dist/sitemap.xml` includes the routes (noIndex excluded).
6. Console config (one-time): paste `/signal` + `/signal/<slug>` rewrites from `infra/amplify-rewrites.json`
   into Amplify; wire the webhooks per `docs/runbooks/signal-publish-webhook.md` (or plan manual redeploy).
7. Deploy & verify live: trigger a build (push to main, webhook, or manual redeploy). Visit the real site:
   `/signal` lists issues; each `/signal/<slug>` renders body + images (CSP via `cdn.sanity.io`); meta/OG
   correct; sitemap served. Account for the 1-year CloudFront cache — a redeploy invalidates the edge.

## File & Code Changes
| Action | File Path | Description |
|---|---|---|
| Modify (optional) | `studio/schemaTypes/objects/blockContent.ts` | Add `code` decorator to `marks.decorators` |
| None (content) | Sanity content lake (project `pe7zq1it`) | The 2-3 issues are authored content, not repo files |
| None (artifact) | `src/content/issues.generated.json` | Regenerated at build from Sanity; repo copy stays `[]` |
| Modify (optional) | `docs/PROJECT_STATUS.md` | Flip the Signal section to "issues live" once verified |
| None | `Signal.jsx`, `SignalIssue.jsx`, `IssueBody.jsx`, `fetch-issues.mjs`, `prerender.mjs`, rewrites | Pipeline complete |

## Testing & Validation
- Unit: `node --test scripts/fetch-issues.test.mjs`; if schema touched, `cd studio && npx sanity dev` builds.
- Pipeline: local `fetch-issues.mjs` populates the JSON; `npm run build` prerenders + sitemap;
  `src/components/IssueBody.test.jsx` guards the renderer.
- Manual (real path): `/signal` index, each `/signal/<slug>`, image rendering, meta/OG, noindex honored,
  known-bad slug → bounce to `/signal`.
- Webhook: publish a throwaway issue → confirm an Amplify build fires; unpublish → confirm it delists.
- Rollback: unpublish or set `status:'draft'` + rebuild → issue delists; JSON returns to `[]`.

## Risk & Mitigation
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Double-publish gate missed | High | Med | Authoring checklist; verify with local fetch-issues before relying on deploy |
| `SANITY_PROJECT_ID` unset in Amplify → build hard-fails | Med | High | Confirm env before publishing; never use `GSS_ALLOW_EMPTY_ISSUES` in prod |
| Private dataset, no read token → empty fetch | Med | High | Confirm public/private; add read-only `SANITY_READ_TOKEN` if private |
| Rewrites not pasted → deep links fall to SPA homepage | Med | Med | Paste `/signal` rewrites from infra/amplify-rewrites.json |
| No webhook → publish doesn't deploy | Med | Low | Wire both webhooks, or use manual redeploy |
| CloudFront 1-yr cache hides update | Med | Low | Redeploy invalidates the edge |
| Empty alt text published | Low | Low | Alt is warning-only; enforce in review or harden schema |

## Dependencies & Order of Operations
- Sequential: confirm env/Studio → author + publish → local verify → console config → deploy + verify.
- Parallelizable: writing the issue content while env/console wiring is confirmed.
- External blockers: Sanity access; Amplify env + rewrites + webhooks (console-only).

## Estimated Effort
- Complexity: Low-Medium (config + content; ~0-3 lines of code). Time: ~2-4h config + writing time.
  Files: 0-1 code change; the rest is content + console.

## Decision Points
dataset public vs private (read token?); add inline-code decorator?; enforce image alt text?; confirm
`SANITY_PROJECT_ID` is set in Amplify; issue topic/cadence (recommend a quarterly "State of Quantum
Funding, for operators" built on attributed sources).
