# The Signal newsletter — public archive + email distribution — Design Spec

**Date:** 2026-06-26
**Author:** Christian Perez (with Claude Code)
**Status:** Approved (design); not yet implemented.
**Repo in scope:** `ground-state` (`groundstatesociety.com`) — owns the landing site, the prerender
pipeline, and the shared `backend/subscribe` capture/verify backend.

---

## 1. Goal

Ship "The Signal" — the free newsletter that goes out to people who complete the existing
zero-friction email sign-up — as **two channels off one piece of content**:

1. **Delivery / retention** — email each issue to confirmed subscribers (the thing they signed up for).
2. **Acquisition / SEO / AEO** — publish a **public web version** of each issue at a stable URL on
   `groundstatesociety.com`. Public HTML is the only thing search crawlers and AI answer engines
   (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google AI Overviews) can read, so the web
   archive is the top-of-funnel that drives new sign-ups.

**The crux the design resolves:** gating content behind a login does the *opposite* of helping
SEO/AEO — gated bytes are invisible to crawlers (the project's own quantum-module spec already
records this: gated lesson prose is "not indexable by Google"). So discovery comes from *publishing*
publicly, never from gating. Nothing in this feature is gated.

## 2. Locked decisions (confirmed with the user)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Distribution model | **Dual channel**: public web archive (SEO/AEO) + email to subscribers. Not gated. |
| D2 | Build vs buy | **In-house**, on our own domain and stack — fits the established own-the-stack pattern (`backend/checkout`, `backend/subscribe`, the custom prerender pipeline). |
| D3 | Authoring | **Headless CMS (Sanity).** Author/publish issues from a web UI; publishing redeploys the site with no code push. |
| D4 | Recipients | Send to **all `confirmed` subscribers regardless of source tag** (`signal` + `quantum-intro`) — the newsletter *is* the Signal tier. |
| D5 | Email body | **Full issue in the email** (best reader experience; what premium independent newsletters do). The public page is for discovery, not a teaser wall. |
| D6 | Studio hosting | **Separately-deployed Studio** (Sanity-hosted / its own subdomain). Do **not** embed Studio into the public Vite bundle — keep the public site lean. |
| D7 | Phasing | **Phase A (public archive) ships first**, then **Phase B (email distribution)**. Two independently valuable sub-projects sharing one content model. |

## 3. Architecture: one source, two outputs

```
                    ┌─────────────────────────────┐
                    │   Sanity  (issue documents)  │  ← authored here
                    └──────────────┬──────────────┘
                  build-time fetch │ (GROQ)        │ on "send"
                          ┌────────┘               └────────┐
                          ▼                                  ▼
        ┌──────────────────────────────┐   ┌──────────────────────────────┐
        │  PUBLIC WEB ARCHIVE (SEO/AEO) │   │   EMAIL (delivery/retention)  │
        │  prerender.mjs → static HTML  │   │  PT→HTML → Postmark Broadcast │
        │  /signal + /signal/<slug>     │   │  → confirmed DynamoDB list    │
        │  indexed by Google + AI bots  │   │  the thing they signed up for │
        └──────────────────────────────┘   └──────────────────────────────┘
```

**Why this shape.** The repo already has a custom SSR/prerender pipeline
(`vite build --ssr src/entry-static.jsx` → `scripts/prerender.mjs`) whose header comment explicitly
targets non-JS AEO crawlers and emits real static HTML per route with per-page head injection. The
public archive is therefore **not a new system** — it is new (build-time-generated) entries in that
pipeline's `ROUTES` list plus Amplify rewrites, exactly like `/story` and `/apply` are today. The
email channel reuses the proven dependency-free SAM-Lambda pattern and the existing
`backend/subscribe` table + Postmark sender.

## 4. Non-goals / boundaries

- **No gating, no paywall, no member login** for the newsletter. The free issues are public by design
  (that is the discovery engine). A premium/paywalled tier is explicitly out of scope here.
- **No new ESP / marketing platform.** Sending reuses the existing confirmed list (DynamoDB) +
  Postmark; we do not adopt Beehiiv/Kit/Substack and do not fork the subscriber list off our stack.
- **Studio is not embedded** in the public Vite app (D6).
- Respect the `ground-state` intent: quiet, honest UI and copy — no popups, countdowns, fake scarcity,
  or emoji, on the archive pages or in the email.
- This spec covers the Signal newsletter content stream. It does **not** change the quantum-module
  email gate (a separate, server-enforced concern tracked in
  `2026-06-17-quantum-module-email-gate-design.md`).

## 5. Sanity content model

A new Sanity project + `production` dataset. Schema authored per the loaded `schema` rules
(`defineType`/`defineField`/`defineArrayMember`, data-over-presentation naming, icons, slug
validation, reusable shared fields).

**`issue` document type**

| Field | Type | Notes |
|---|---|---|
| `title` | `string` | required |
| `slug` | `slug` | required; lowercase/hyphen validation; unique (async check) |
| `publishedAt` | `datetime` | drives ordering and "sent" gating of the public route |
| `excerpt` | `text` | teaser + default meta description (`rule.max(~160)` warning) |
| `body` | `array` (Portable Text) | `block` + custom `pteImage` (hotspot, required `alt`), `link` annotation |
| `seo` | `object` (reusable `seo` type) | `title`, `description`, `image` (1200×630), `noIndex` (default false) |
| `status` | `string` radio | `draft` \| `published` (per the boolean-vs-list rule) |

Reusable `seo` object type per the SEO rules. GROQ projections use `coalesce(seo.title, title)` /
`coalesce(seo.description, excerpt)` so the frontend never branches on null. `pt::text(body)` is
available for any plain-text need (e.g. structured data).

## 6. Phase A — Public web archive (ships first)

**Routes (React Router, mirrored in the static entry):**
- `/signal` — archive index: published issues, newest first.
- `/signal/<slug>` — one page per issue; renders `body` via `@portabletext/react`.

**Prerender integration (`scripts/prerender.mjs`):**
- Add a build-time Sanity client (`@sanity/client`, dated `apiVersion`, CDN read).
- Replace the today-hardcoded `ROUTES` list's static newsletter entries with a **GROQ fetch** of
  published issues (`*[_type == "issue" && status == "published" && defined(slug.current)] |
  order(publishedAt desc){ ... }`), generating one `ROUTES` entry per issue plus the `/signal` index.
- Each issue route renders through the existing `Static` SSR entry and the existing `injectHead()`
  (title/description/canonical/OG), so each issue page paints real content + correct head **from
  static HTML**, before React boots — indexable by non-JS crawlers. Keep the existing `expect`-marker
  guard so a broken render fails the build.
- **Stega off** for the prerender fetch (the SEO rule: stega characters in `<title>` break SEO).

**Sitemap + rewrites:**
- Extend the sitemap (the project already ships one) to include `/signal` and every published issue
  URL with `lastModified` from `_updatedAt`.
- Add Amplify rewrites for `/signal` and `/signal/<slug>` → their prerendered HTML (same pattern as
  the `/story`, `/apply` rewrites pasted from `infra/amplify-rewrites.json`; these are applied in the
  Amplify console, not auto-deployed — call this out in the runbook).

**Publish → rebuild (closes the "no code push" loop, D3):**
- A Sanity **GROQ-powered webhook** (filter: `_type == "issue"`) calls an **Amplify incoming build
  webhook**, so publishing an issue in the Studio triggers a redeploy that regenerates the static
  archive. Verify during planning: webhook secret/signature handling and debouncing rapid edits.

**SEO/AEO specifics:**
- Per-issue `<title>`, meta description (`coalesce(seo.description, excerpt)`), canonical
  (`https://groundstatesociety.com/signal/<slug>`), and OG/Twitter image
  (`seo.image` at 1200×630 via the Sanity image URL builder).
- Optional `Article`/`BlogPosting` JSON-LD per issue (E-E-A-T; author = Christian Perez), consistent
  with the existing `/story` E-E-A-T treatment.

**Phase A is independently shippable and carries no send risk.**

## 7. Phase B — Email distribution

Built on the same Sanity content model; reuses `backend/subscribe`'s table, Postmark sender, and
dependency-free SAM-Lambda style.

**Send pipeline:**
1. Trigger a send for a chosen published issue (operator-initiated; mechanism — CLI/Lambda/Studio
   document action — chosen in planning).
2. Fetch the issue `body` from Sanity → render to **email-safe HTML** with `@portabletext/to-html`
   (custom serializers for `pteImage`/`link`), wrapped in a simple, inlined-CSS email template
   consistent with the GSS confirmation email's restraint.
3. Send via a **Postmark Broadcast message stream** — kept separate from the `outbound` transactional
   stream (the `backend/subscribe` README already plans this isolation so the newsletter can never
   share the confirmation email's sender reputation).
4. **Recipients (D4):** query DynamoDB for `status == confirmed` subscribers (all sources). Confirm
   in planning whether recipients are pushed per-send to Postmark or maintained as a Postmark list.

**Unsubscribe + compliance (extends `backend/subscribe`):**
- One-click unsubscribe link in every issue → endpoint that flips `status = unsubscribed`
  (instantly honored), satisfying the compliance section already specified for the capture backend.
- Honor Postmark suppression (bounces/complaints) — the `POST /postmark-webhook` suppression route is
  already deployed and live-verified (commit aa63080); reuse it for the broadcast stream.
- Physical-address / sender-identity footer as required for bulk mail.

**Things to verify during planning (per the "verify external services" rule):** Postmark Broadcast
exact send mechanics — batch size limits, per-recipient vs broadcast-list model, how Postmark injects
the unsubscribe link and reconciles it with our DynamoDB `unsubscribed` state. No Postmark doc source
was available at design time; do not assume — confirm against Postmark's current API before building.

## 8. Components (each one clear responsibility)

| Component | Lives in | Responsibility | Depends on |
|-----------|----------|----------------|------------|
| Sanity `issue` schema + `seo` type | new Sanity project / Studio | Model an issue + its SEO metadata | — |
| Sanity Studio (separate deploy) | Sanity-hosted / own subdomain | Authoring UI; publish action | Sanity project |
| Build-time issue fetch | `scripts/prerender.mjs` (+ a small `src/lib/sanity` client) | GROQ-fetch published issues → generate routes | `@sanity/client` |
| Archive index route | `src/pages` / `src/sections` | List published issues newest-first | fetched issue list |
| Issue route + PT renderer | `src/pages` | Render one issue's `body` to HTML | `@portabletext/react` |
| Sitemap + Amplify rewrites | sitemap source + `infra/amplify-rewrites.json` | Make `/signal*` crawlable + served | — |
| Publish webhook | Sanity webhook → Amplify build webhook | Redeploy on publish | Amplify build hook |
| Email renderer | `backend/` (new) | Issue `body` → inlined-CSS email HTML | `@portabletext/to-html` |
| Broadcast sender | `backend/` (new) | Send issue to confirmed list via Postmark Broadcast | Postmark, DynamoDB |
| Unsubscribe endpoint | `backend/subscribe` (extend) | Flip `status = unsubscribed`, one click | DynamoDB |

## 9. Verification (per the project's "run the real thing" rule)

Mocked fetches and green unit tests are **not** sufficient evidence. Before claiming done:

- **Phase A:** publish a real issue in Sanity → confirm the publish webhook triggers an Amplify build
  → load `/signal/<slug>` and confirm the issue prose + correct `<title>`/description/canonical/OG are
  present in **view-source / static HTML** (not just after hydration) → confirm `/signal` lists it →
  confirm it appears in the sitemap → fetch as a non-JS client (e.g. `curl`) and confirm content is
  present. Submit/inspect the URL for indexing.
- **Phase B:** send a real test issue to a real inbox → confirm it renders correctly across at least
  one major client → confirm the unsubscribe link flips `status` and the address no longer receives →
  confirm Postmark suppression (bounce/complaint) is honored.

## 10. Open items (defaults applied; revisit if needed)

- Issue route base path: **`/signal`** (matches the tier name). Revisit if a different IA is wanted.
- Studio domain: Sanity-hosted vs `studio.groundstatesociety.com` — decide in planning (D6 only fixes
  that it is *separate*, not embedded).
- Send trigger mechanism (CLI vs Lambda vs Studio document action) — decide in planning.
- Postmark Broadcast recipient model + unsubscribe reconciliation — **verify against Postmark docs**
  (Section 7) before building Phase B.
- JSON-LD per issue: include `BlogPosting`/`Article` — recommended, confirm in planning.

---

*Sanity integration shape verified against current Sanity rules (`schema`, `groq`, `portable-text`,
`seo`) and docs via the Sanity MCP at design time: `@portabletext/react` is framework-agnostic (valid
for this Vite/SSR setup), GROQ-powered webhooks are the supported publish-trigger mechanism, and the
SEO patterns (reusable `seo` object, `coalesce()` fallbacks, `stega:false` for metadata) port onto the
existing `prerender.mjs` head injection. Postmark Broadcast mechanics are explicitly deferred to
planning-time verification.*
