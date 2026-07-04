/*
 * Build-time fetch of published newsletter issues from Sanity into a static
 * JSON module the client bundle and the prerender pipeline both read. Runs
 * FIRST in `npm run build`. The browser never imports @sanity/client — only
 * the generated public JSON is bundled.
 *
 * Fail-safe by default: a production build must never silently delist the
 * archive. BOTH an unset SANITY_PROJECT_ID and a configured fetch that yields
 * zero publishable issues are hard errors unless GSS_ALLOW_EMPTY_ISSUES=1
 * explicitly opts into the empty list (local preview builds, and production
 * only until the first issue publishes — remove the flag then).
 *
 * normalizeIssues is the single owner of the seo fallback contract: every
 * issue it emits carries seo = { title, description, ogImage, noIndex } with
 * the title/excerpt fallbacks already applied — consumers (prerender,
 * SignalIssue) trust those fields as-is and must not re-fallback.
 */
import { pathToFileURL } from 'node:url'
import { writeFile, mkdir } from 'node:fs/promises'
import { createClient } from '@sanity/client'

const OUT = new URL('../src/content/issues.generated.json', import.meta.url)

const QUERY = `*[_type == "issue" && status == "published" && defined(slug.current)] | order(publishedAt desc){
  "slug": slug.current,
  title,
  publishedAt,
  excerpt,
  "seo": {
    "title": seo.title,
    "description": seo.description,
    "ogImage": seo.image.asset->url,
    "noIndex": seo.noIndex == true
  },
  body[]{
    ...,
    _type == "pteImage" => {
      ...,
      "url": image.asset->url,
      "dimensions": image.asset->metadata.dimensions
    }
  }
}`

// Mirrors the Studio's slug rule (issue.ts). The GROQ fetch bypasses that
// client-side validation, so re-enforce it here: an invalid slug would land
// unescaped in the sitemap <loc> AND in the prerender output path
// (signal/<slug>.html), so a stray slash/dot/& must never reach either.
const SLUG_RE = /^[a-z0-9-]+$/

export function normalizeIssues(rawDocs) {
  if (!Array.isArray(rawDocs)) return []
  const seen = new Set()
  return rawDocs
    .filter((d) => {
      if (!d || typeof d.slug !== 'string' || d.slug.length === 0) return false
      if (!SLUG_RE.test(d.slug)) {
        console.warn(
          `fetch-issues: skipping issue with invalid slug ${JSON.stringify(d.slug)} (expected ^[a-z0-9-]+$)`,
        )
        return false
      }
      // Duplicate slugs would corrupt the prerender output path and the
      // sitemap. Raw order is publishedAt desc, so keep the newest.
      if (seen.has(d.slug)) {
        console.warn(
          `fetch-issues: skipping duplicate slug ${JSON.stringify(d.slug)} (keeping the newest)`,
        )
        return false
      }
      seen.add(d.slug)
      return true
    })
    .map((d) => {
      // Kept-but-degraded issues ship a live page — leave a trace (same style
      // as the drop-warns above) instead of a silent hollow render.
      if (!Array.isArray(d.body) || d.body.length === 0) {
        console.warn(`fetch-issues: issue "${d.slug}" kept with an empty body — its live page will render hollow`)
      }
      if (!d.title) {
        console.warn(`fetch-issues: issue "${d.slug}" kept with an empty title`)
      }
      return {
        slug: d.slug,
        title: d.title ?? '',
        publishedAt: d.publishedAt ?? null,
        excerpt: d.excerpt ?? '',
        // The ONE owner of the seo fallback rule — consumers trust these fields.
        seo: {
          title: d.seo?.title ?? d.title ?? '',
          description: d.seo?.description ?? d.excerpt ?? '',
          ogImage: d.seo?.ogImage ?? null,
          noIndex: d.seo?.noIndex === true,
        },
        body: Array.isArray(d.body) ? d.body : [],
      }
    })
}

/* The zero-issue guard, covering the CONFIGURED-but-empty case the unset-
   credential guard in main() cannot see: a wrong dataset or an un-Published
   corpus must fail the build, not silently delist the archive. Pure +
   exported for tests. */
export function guardEmptyIssues(issues, env = process.env) {
  if (issues.length > 0) return
  if (env.GSS_ALLOW_EMPTY_ISSUES !== '1') {
    throw new Error(
      'fetch-issues: the configured Sanity fetch returned zero publishable issues — refusing ' +
        'to delist the newsletter archive on a green build. If this is intentional (pre-first-issue ' +
        'or a preview), set GSS_ALLOW_EMPTY_ISSUES=1.',
    )
  }
  console.warn('fetch-issues: zero issues + GSS_ALLOW_EMPTY_ISSUES=1 — writing empty issue list')
}

async function main() {
  await mkdir(new URL('../src/content/', import.meta.url), { recursive: true })

  const projectId = process.env.SANITY_PROJECT_ID
  if (!projectId) {
    // Fail-safe by default. A production build with no SANITY_PROJECT_ID would
    // write an empty list, prerender zero /signal pages, and collapse the
    // sitemap — silently delisting the entire newsletter archive on a green
    // deploy. So a missing project id is a hard error unless the empty-list
    // path is EXPLICITLY opted into (local/preview builds with no Sanity).
    // We do not auto-detect "CI"/Amplify env vars here: production sets
    // SANITY_PROJECT_ID and never this flag, so a credential loss cannot slip
    // through by accidentally matching a guessed env signal.
    if (process.env.GSS_ALLOW_EMPTY_ISSUES !== '1') {
      throw new Error(
        'fetch-issues: SANITY_PROJECT_ID is unset. A production build requires it — refusing ' +
          'to write an empty issue list (that would delist the entire newsletter archive). For ' +
          'an intentional local/preview build with no Sanity, set GSS_ALLOW_EMPTY_ISSUES=1.',
      )
    }
    console.warn(
      'fetch-issues: SANITY_PROJECT_ID unset + GSS_ALLOW_EMPTY_ISSUES=1 — writing empty issue list (preview build)',
    )
    await writeFile(OUT, '[]\n')
    return
  }

  const client = createClient({
    projectId,
    dataset: process.env.SANITY_DATASET || 'production',
    apiVersion: process.env.SANITY_API_VERSION || '2026-06-01',
    token: process.env.SANITY_READ_TOKEN || undefined,
    useCdn: false,
  })

  // Non-secret query context — makes a wrong-dataset build diagnosable from
  // the Amplify log alone. Never the token value.
  console.log(
    `fetch-issues: querying ${projectId}/${process.env.SANITY_DATASET || 'production'} ` +
      `(token: ${process.env.SANITY_READ_TOKEN ? 'present' : 'absent'})`,
  )
  const raw = await client.fetch(QUERY)
  const issues = normalizeIssues(raw)
  guardEmptyIssues(issues)
  await writeFile(OUT, JSON.stringify(issues, null, 2) + '\n')
  const fetched = Array.isArray(raw) ? raw.length : 0
  console.log(
    `fetch-issues: wrote ${issues.length} of ${fetched} fetched (dropped ${fetched - issues.length}) → src/content/issues.generated.json`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((err) => {
    console.error('fetch-issues: failed', err)
    process.exit(1)
  })
}
