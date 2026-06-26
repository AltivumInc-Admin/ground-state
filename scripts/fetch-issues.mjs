/*
 * Build-time fetch of published newsletter issues from Sanity into a static
 * JSON module the client bundle and the prerender pipeline both read. Runs
 * FIRST in `npm run build`. The browser never imports @sanity/client — only
 * the generated public JSON is bundled. If SANITY_PROJECT_ID is unset, writes
 * an empty list so the build still succeeds (mirrors the inert-preview
 * convention used for unset VITE_* endpoints).
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { createClient } from '@sanity/client'

const OUT = new URL('../src/content/issues.generated.json', import.meta.url)

const QUERY = `*[_type == "issue" && status == "published" && defined(slug.current)] | order(publishedAt desc){
  "slug": slug.current,
  title,
  publishedAt,
  excerpt,
  "seo": {
    "title": coalesce(seo.title, title),
    "description": coalesce(seo.description, excerpt),
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

export function normalizeIssues(rawDocs) {
  if (!Array.isArray(rawDocs)) return []
  return rawDocs
    .filter((d) => d && typeof d.slug === 'string' && d.slug.length > 0)
    .map((d) => ({
      slug: d.slug,
      title: d.title ?? '',
      publishedAt: d.publishedAt ?? null,
      excerpt: d.excerpt ?? '',
      seo: {
        title: d.seo?.title ?? d.title ?? '',
        description: d.seo?.description ?? d.excerpt ?? '',
        ogImage: d.seo?.ogImage ?? null,
        noIndex: d.seo?.noIndex === true,
      },
      body: Array.isArray(d.body) ? d.body : [],
    }))
}

async function main() {
  await mkdir(new URL('../src/content/', import.meta.url), { recursive: true })

  const projectId = process.env.SANITY_PROJECT_ID
  if (!projectId) {
    console.warn('fetch-issues: SANITY_PROJECT_ID unset — writing empty issue list')
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

  const raw = await client.fetch(QUERY)
  const issues = normalizeIssues(raw)
  await writeFile(OUT, JSON.stringify(issues, null, 2) + '\n')
  console.log(`fetch-issues: wrote ${issues.length} issue(s) → src/content/issues.generated.json`)
}

main().catch((err) => {
  console.error('fetch-issues: failed', err)
  process.exit(1)
})
