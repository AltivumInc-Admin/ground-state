# The Signal Newsletter — Phase A (Public Web Archive) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish each Sanity-authored newsletter issue as an indexable static HTML page on `groundstatesociety.com` (`/signal` archive index + `/signal/<slug>` per issue), so the free newsletter becomes the site's SEO/AEO acquisition engine.

**Architecture:** Issues are authored in a standalone Sanity Studio. At build time a Node script fetches published issues via GROQ into a committed-but-build-regenerated JSON module; the React routes and the existing `react-dom/static` prerender pipeline both read that module, so each issue paints as real static HTML (indexable by non-JS crawlers) and hydrates cleanly from bundled data. The browser never talks to Sanity. Publishing an issue fires a Sanity webhook at an Amplify build hook to redeploy.

**Tech Stack:** Vite 7 + React 19 + react-router-dom 7 (existing); `react-dom/static` prerender (existing `scripts/prerender.mjs`); Sanity Studio (`studio/`, standalone); `@sanity/client` (build-time only); `@portabletext/react` (issue body rendering); AWS Amplify Hosting (rewrites, build webhook).

## Global Constraints

- **Code style:** No semicolons, single quotes, 2-space indent (matches all existing `src/**` and `scripts/**`). ES modules (`"type": "module"`).
- **No emojis** anywhere in user-facing UI, copy, buttons, labels, or placeholders (global UI rule + project intent). Quiet, honest copy — no popups, countdowns, or fake scarcity.
- **Node 22**, arm64 build environment (matches `backend/` stacks).
- **SEO/AEO is the whole point of Phase A:** issue content MUST be present in static HTML (view-source), not only after hydration. Any task that ends with content only reachable after JS executes is a failed task.
- **Client bundle must contain NO Sanity client and NO Sanity tokens.** Only the generated JSON (public content) is bundled. Sanity env vars are unprefixed (`SANITY_*`), read by the Node build script via `process.env` only — never `VITE_`-prefixed.
- **Site origin:** `https://groundstatesociety.com`. Issue route base: `/signal`.
- **Hydration gate (existing, do not break):** `scripts/prerender.mjs` stamps `#root` with `data-route="<path>"`; `src/main.jsx` hydrates only when `container.dataset.route === window.location.pathname`, else wipes and client-renders. Every new prerendered route must stamp its own `data-route` and include its `expect` marker string in the rendered markup.
- **Amplify rewrites are applied manually** in the Amplify console (pasted from `infra/amplify-rewrites.json`); they are NOT auto-deployed. Rule order matters: specific rules before the SPA catch-all regex.
- **Tests:** frontend via `npm run test:fe` (vitest, jsdom, `@testing-library/react`); Node scripts via `node --test`. The repo `npm test` runs the backend Node suites and gates the Amplify deploy.

---

### Task 1: Sanity Studio, schema, and first published issue

**Files:**
- Create: `studio/` (scaffolded by the Sanity CLI — `sanity.config.ts`, `sanity.cli.ts`, `package.json`, etc.)
- Create: `studio/schemaTypes/objects/seo.ts`
- Create: `studio/schemaTypes/blocks/pteImage.ts`
- Create: `studio/schemaTypes/documents/issue.ts`
- Create: `studio/schemaTypes/index.ts`

**Interfaces:**
- Produces: a deployed Sanity schema with a published `issue` document type and **at least one published `issue`**; a `projectId` and `dataset` (record them — Task 2 needs them). The `issue` shape downstream tasks rely on:
  - `slug.current` (string), `title` (string), `publishedAt` (datetime ISO string), `excerpt` (string), `status` (`'draft' | 'published'`)
  - `body` (Portable Text array of `block` + `pteImage`)
  - `seo` object: `title?`, `description?`, `image?` (Sanity image), `noIndex` (boolean)

- [ ] **Step 1: Scaffold a standalone Studio** (run from repo root, NOT inside any app folder)

```bash
npm create sanity@latest -- --template clean --typescript --output-path studio
```

Follow the prompts: log in, **create a new project** named `Ground State Society`, use dataset `production`, and choose **public** dataset visibility (the newsletter is public content; this lets the build read it without a token). Record the printed **projectId**.

- [ ] **Step 2: Write the reusable SEO object** (`studio/schemaTypes/objects/seo.ts`)

```typescript
import { defineField, defineType } from 'sanity'

export const seo = defineType({
  name: 'seo',
  title: 'SEO',
  type: 'object',
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({
      name: 'title',
      title: 'SEO title',
      description: 'Overrides the issue title in search/social. Falls back to the title.',
      type: 'string',
      validation: (rule) => rule.max(70).warning('Keep under ~70 characters'),
    }),
    defineField({
      name: 'description',
      title: 'SEO description',
      description: 'Falls back to the excerpt.',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.max(160).warning('Keep under ~160 characters'),
    }),
    defineField({
      name: 'image',
      title: 'Social share image',
      description: '1200x630 recommended.',
      type: 'image',
      options: { hotspot: true },
    }),
    defineField({
      name: 'noIndex',
      title: 'Hide from search engines',
      type: 'boolean',
      initialValue: false,
    }),
  ],
})
```

- [ ] **Step 3: Write the in-body image block** (`studio/schemaTypes/blocks/pteImage.ts`)

```typescript
import { ImageIcon } from '@sanity/icons'
import { defineField, defineType } from 'sanity'

export const pteImage = defineType({
  name: 'pteImage',
  title: 'Image',
  type: 'object',
  icon: ImageIcon,
  fields: [
    defineField({ name: 'image', type: 'image', options: { hotspot: true } }),
    defineField({ name: 'caption', type: 'string' }),
    defineField({
      name: 'alt',
      title: 'Alt text',
      type: 'string',
      validation: (rule) => rule.required().error('Alt text is required for accessibility'),
    }),
  ],
  preview: { select: { title: 'caption', subtitle: 'alt', media: 'image' } },
})
```

- [ ] **Step 4: Write the issue document** (`studio/schemaTypes/documents/issue.ts`)

```typescript
import { DocumentTextIcon } from '@sanity/icons'
import { defineArrayMember, defineField, defineType } from 'sanity'

export const issue = defineType({
  name: 'issue',
  title: 'Issue',
  type: 'document',
  icon: DocumentTextIcon,
  fields: [
    defineField({ name: 'title', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (rule) =>
        rule.required().custom((slug) => {
          if (!slug?.current) return 'Required'
          if (!/^[a-z0-9-]+$/.test(slug.current)) return 'Lowercase letters, numbers, and hyphens only'
          return true
        }),
    }),
    defineField({
      name: 'status',
      type: 'string',
      options: {
        list: [
          { title: 'Draft', value: 'draft' },
          { title: 'Published', value: 'published' },
        ],
        layout: 'radio',
      },
      initialValue: 'draft',
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'publishedAt', type: 'datetime', validation: (rule) => rule.required() }),
    defineField({
      name: 'excerpt',
      type: 'text',
      rows: 3,
      description: 'One-paragraph teaser. Used as the default meta description.',
      validation: (rule) => rule.required().max(200),
    }),
    defineField({
      name: 'body',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'block',
          marks: {
            annotations: [
              {
                name: 'link',
                type: 'object',
                title: 'Link',
                fields: [{ name: 'href', type: 'url', title: 'URL' }],
              },
            ],
          },
        }),
        defineArrayMember({ type: 'pteImage' }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'seo', type: 'seo' }),
  ],
  orderings: [
    {
      title: 'Published date, newest first',
      name: 'publishedDesc',
      by: [{ field: 'publishedAt', direction: 'desc' }],
    },
  ],
  preview: {
    select: { title: 'title', subtitle: 'status', date: 'publishedAt' },
    prepare: ({ title, subtitle, date }) => ({
      title,
      subtitle: `${subtitle ?? 'draft'} · ${date ? new Date(date).toISOString().slice(0, 10) : 'no date'}`,
    }),
  },
})
```

- [ ] **Step 5: Register the types** (`studio/schemaTypes/index.ts`)

```typescript
import { issue } from './documents/issue'
import { pteImage } from './blocks/pteImage'
import { seo } from './objects/seo'

export const schemaTypes = [issue, seo, pteImage]
```

Ensure `studio/sanity.config.ts` imports `schemaTypes` into `schema: { types: schemaTypes }` (the `clean` template wires this; verify the import path matches the folder layout above).

- [ ] **Step 6: Deploy the schema**

Run: `cd studio && npx sanity schema deploy`
Expected: "Schema deployed" with the `issue` type listed.

- [ ] **Step 7: Run the Studio and publish one real issue**

Run: `cd studio && npx sanity dev` → open `http://localhost:3333`. Create an `Issue`: real title, slug, `status = published`, `publishedAt` = now, an excerpt, and a body with at least one heading, one link, and one image (with alt text). Click **Publish**.

- [ ] **Step 8: Verify the published issue is queryable**

Run (from `studio/`): `npx sanity documents query '*[_type == "issue" && status == "published"]{ "slug": slug.current, title, publishedAt }'`
Expected: a JSON array containing your issue with a `slug`, `title`, and `publishedAt`.

- [ ] **Step 9: Deploy the Studio (hosted) and commit**

Run: `cd studio && npx sanity deploy` (pick a studio hostname, e.g. `ground-state`). Then commit the Studio source from the repo root:

```bash
git add studio
git commit -m "feat(signal): standalone Sanity Studio + issue schema"
```

---

### Task 2: Build-time issue fetch script

**Files:**
- Create: `scripts/fetch-issues.mjs`
- Create: `scripts/fetch-issues.test.mjs`
- Modify: `package.json` (add deps; prepend fetch step to `build`)
- Modify: `.env.example`

**Interfaces:**
- Consumes: `process.env.SANITY_PROJECT_ID`, `process.env.SANITY_DATASET` (default `production`), `process.env.SANITY_API_VERSION` (default `2026-06-01`), optional `process.env.SANITY_READ_TOKEN`.
- Produces: writes `src/content/issues.generated.json` — an array (newest-first) of `{ slug, title, publishedAt, excerpt, seo: { title, description, ogImage, noIndex }, body }`. Exports a pure `normalizeIssues(rawDocs)` for testing.

- [ ] **Step 1: Write the failing test** (`scripts/fetch-issues.test.mjs`)

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeIssues } from './fetch-issues.mjs'

test('normalizeIssues keeps published fields and defaults seo from title/excerpt', () => {
  const raw = [
    {
      slug: 'first-light',
      title: 'First Light',
      publishedAt: '2026-06-20T12:00:00Z',
      excerpt: 'A short teaser.',
      seo: { title: null, description: null, ogImage: null, noIndex: false },
      body: [{ _type: 'block', children: [{ text: 'Hi' }] }],
    },
  ]
  const out = normalizeIssues(raw)
  assert.equal(out.length, 1)
  assert.equal(out[0].slug, 'first-light')
  assert.equal(out[0].seo.title, 'First Light') // falls back to title
  assert.equal(out[0].seo.description, 'A short teaser.') // falls back to excerpt
  assert.ok(Array.isArray(out[0].body))
})

test('normalizeIssues drops entries without a slug', () => {
  const out = normalizeIssues([{ title: 'No slug', body: [] }])
  assert.equal(out.length, 0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/fetch-issues.test.mjs`
Expected: FAIL — `normalizeIssues` is not exported / module not found.

- [ ] **Step 3: Write the script** (`scripts/fetch-issues.mjs`)

```javascript
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
```

- [ ] **Step 4: Add dependencies**

Run: `npm install @portabletext/react` and `npm install -D @sanity/client`
(`@portabletext/react` is a runtime dependency — it is bundled into the client by Task 4. `@sanity/client` is dev-only — build script use only.)

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test scripts/fetch-issues.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 6: Prepend the fetch step to the build script** (`package.json`)

Change the `build` script to:

```json
"build": "node scripts/fetch-issues.mjs && vite build && vite build --ssr src/entry-static.jsx --outDir dist-ssr && node scripts/prerender.mjs",
```

- [ ] **Step 7: Document env in `.env.example`** (append)

```
# Sanity (build-time only — read by scripts/fetch-issues.mjs via Node, NEVER VITE_-prefixed,
# so no Sanity client or token ever ships to the browser). projectId from `sanity manage`.
SANITY_PROJECT_ID=
SANITY_DATASET=production
SANITY_API_VERSION=2026-06-01
# Only needed if the dataset is PRIVATE. Leave unset for a public dataset.
SANITY_READ_TOKEN=
```

- [ ] **Step 8: Commit**

```bash
git add scripts/fetch-issues.mjs scripts/fetch-issues.test.mjs package.json package-lock.json .env.example
git commit -m "feat(signal): build-time Sanity issue fetch into generated JSON"
```

---

### Task 3: Issue data accessor + seed file

**Files:**
- Create: `src/content/issues.generated.json` (committed seed; build regenerates it)
- Create: `src/lib/issues.js`
- Create: `src/lib/issues.test.js`

**Interfaces:**
- Consumes: `src/content/issues.generated.json` (Task 2 shape).
- Produces: `allIssues` (array, newest-first) and `getIssueBySlug(slug)` → issue object or `undefined`. Components and `prerender.mjs` rely on these. Tests of consuming components mock this module.

- [ ] **Step 1: Create the seed generated file** (`src/content/issues.generated.json`)

```json
[]
```

(Committed so `vite dev`, `vitest`, and the SSR build always have the module present. The deploy build overwrites it via `fetch-issues.mjs`, so a stale committed copy never reaches production.)

- [ ] **Step 2: Write the failing test** (`src/lib/issues.test.js`)

```javascript
import { describe, expect, it, vi } from 'vitest'

vi.mock('../content/issues.generated.json', () => ({
  default: [
    { slug: 'b-newer', title: 'B', publishedAt: '2026-06-21T00:00:00Z', excerpt: '', seo: {}, body: [] },
    { slug: 'a-older', title: 'A', publishedAt: '2026-06-10T00:00:00Z', excerpt: '', seo: {}, body: [] },
  ],
}))

const { allIssues, getIssueBySlug } = await import('./issues.js')

describe('issues accessor', () => {
  it('exposes all issues', () => {
    expect(allIssues).toHaveLength(2)
  })
  it('finds an issue by slug', () => {
    expect(getIssueBySlug('a-older')?.title).toBe('A')
  })
  it('returns undefined for an unknown slug', () => {
    expect(getIssueBySlug('nope')).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:fe -- src/lib/issues.test.js`
Expected: FAIL — `./issues.js` not found.

- [ ] **Step 4: Write the accessor** (`src/lib/issues.js`)

```javascript
import issues from '../content/issues.generated.json'

// fetch-issues.mjs already orders by publishedAt desc; this module is a thin,
// testable accessor so components don't import the generated JSON directly.
export const allIssues = issues

export function getIssueBySlug(slug) {
  return allIssues.find((issue) => issue.slug === slug)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:fe -- src/lib/issues.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/content/issues.generated.json src/lib/issues.js src/lib/issues.test.js
git commit -m "feat(signal): issue data accessor + seed generated file"
```

---

### Task 4: Portable Text body renderer

**Files:**
- Create: `src/components/IssueBody.jsx`
- Create: `src/components/IssueBody.test.jsx`

**Interfaces:**
- Consumes: an issue `body` (Portable Text array; `block` + `pteImage` with resolved `url`/`alt`/`dimensions`, `link` annotation with `href`).
- Produces: `<IssueBody value={body} />` — renders headings, paragraphs, links, and images. Used by Task 6.

- [ ] **Step 1: Write the failing test** (`src/components/IssueBody.test.jsx`)

```jsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import IssueBody from './IssueBody.jsx'

const value = [
  { _type: 'block', style: 'h2', _key: '1', children: [{ _type: 'span', _key: 's1', text: 'A Heading', marks: [] }], markDefs: [] },
  {
    _type: 'block',
    style: 'normal',
    _key: '2',
    markDefs: [{ _type: 'link', _key: 'l1', href: 'https://example.com' }],
    children: [{ _type: 'span', _key: 's2', text: 'a link', marks: ['l1'] }],
  },
  { _type: 'pteImage', _key: '3', url: 'https://cdn.sanity.io/img.png', alt: 'a particle in a well', caption: 'Fig 1' },
]

describe('IssueBody', () => {
  it('renders headings, external links, and images with alt text', () => {
    render(<IssueBody value={value} />)
    expect(screen.getByRole('heading', { level: 2, name: 'A Heading' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'a link' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getByRole('img', { name: 'a particle in a well' })).toBeInTheDocument()
  })

  it('renders nothing for an empty body', () => {
    const { container } = render(<IssueBody value={[]} />)
    expect(container.querySelector('.issue-body')).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:fe -- src/components/IssueBody.test.jsx`
Expected: FAIL — `./IssueBody.jsx` not found.

- [ ] **Step 3: Write the renderer** (`src/components/IssueBody.jsx`)

```jsx
import { PortableText } from '@portabletext/react'

const components = {
  block: {
    h2: ({ children }) => <h2>{children}</h2>,
    h3: ({ children }) => <h3>{children}</h3>,
    blockquote: ({ children }) => <blockquote>{children}</blockquote>,
    normal: ({ children }) => <p>{children}</p>,
  },
  marks: {
    link: ({ children, value }) => {
      const href = value?.href ?? '#'
      const external = !href.startsWith('/')
      return (
        <a
          href={href}
          {...(external ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
        >
          {children}
        </a>
      )
    },
  },
  types: {
    pteImage: ({ value }) => {
      if (!value?.url) return null
      return (
        <figure className="issue-figure">
          <img src={value.url} alt={value.alt ?? ''} loading="lazy" decoding="async" />
          {value.caption ? <figcaption>{value.caption}</figcaption> : null}
        </figure>
      )
    },
  },
}

export default function IssueBody({ value }) {
  return (
    <div className="issue-body">
      {Array.isArray(value) && value.length > 0 ? (
        <PortableText value={value} components={components} />
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:fe -- src/components/IssueBody.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/IssueBody.jsx src/components/IssueBody.test.jsx
git commit -m "feat(signal): Portable Text issue body renderer"
```

---

### Task 5: Signal archive index page

**Files:**
- Create: `src/pages/Signal.jsx`
- Create: `src/pages/Signal.test.jsx`

**Interfaces:**
- Consumes: `allIssues` from `src/lib/issues.js`; `usePageMeta` from `src/lib/usePageMeta.js`.
- Produces: `<Signal />` route component. Renders a `.signal-archive` container (the prerender `expect` marker for `/signal`), a list of issue links to `/signal/<slug>`, and an honest empty state when there are no issues.

- [ ] **Step 1: Write the failing test** (`src/pages/Signal.test.jsx`)

```jsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/issues.js', () => ({
  allIssues: [
    { slug: 'first-light', title: 'First Light', publishedAt: '2026-06-20T00:00:00Z', excerpt: 'Teaser one.', seo: {}, body: [] },
  ],
}))

const { default: Signal } = await import('./Signal.jsx')

describe('Signal archive index', () => {
  it('lists published issues as links to their pages', () => {
    render(
      <MemoryRouter>
        <Signal />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: /first light/i })
    expect(link).toHaveAttribute('href', '/signal/first-light')
    expect(screen.getByText('Teaser one.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:fe -- src/pages/Signal.test.jsx`
Expected: FAIL — `./Signal.jsx` not found.

- [ ] **Step 3: Write the page** (`src/pages/Signal.jsx`)

```jsx
import { Link } from 'react-router-dom'
import { allIssues } from '../lib/issues.js'
import usePageMeta from '../lib/usePageMeta.js'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function Signal() {
  usePageMeta({
    title: 'The Signal',
    description:
      'The Signal — funding moves, ecosystem intel, and hard-won lessons for the people building the quantum economy. Free to read.',
  })

  return (
    <div className="signal-archive container">
      <header className="signal-archive-head">
        <h1>The Signal</h1>
        <p>Funding moves, ecosystem intel, and hard-won lessons for quantum builders.</p>
      </header>
      {allIssues.length > 0 ? (
        <ul className="signal-archive-list">
          {allIssues.map((issue) => (
            <li key={issue.slug} className="signal-archive-item">
              <Link to={`/signal/${issue.slug}`}>
                <time dateTime={issue.publishedAt ?? undefined}>{formatDate(issue.publishedAt)}</time>
                <h2>{issue.title}</h2>
                {issue.excerpt ? <p>{issue.excerpt}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="signal-archive-empty">The first issue is on its way. Sign up to get it in your inbox.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:fe -- src/pages/Signal.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Signal.jsx src/pages/Signal.test.jsx
git commit -m "feat(signal): /signal archive index page"
```

---

### Task 6: Signal issue page

**Files:**
- Create: `src/pages/SignalIssue.jsx`
- Create: `src/pages/SignalIssue.test.jsx`

**Interfaces:**
- Consumes: `getIssueBySlug` from `src/lib/issues.js`; `IssueBody` from `src/components/IssueBody.jsx`; `usePageMeta`; `useParams`, `Navigate`, `Link` from react-router-dom.
- Produces: `<SignalIssue />` route component for `/signal/:slug`. Renders a `.signal-issue` container (the prerender `expect` marker for issue pages), the issue title/date/body; redirects unknown slugs to `/signal`.

- [ ] **Step 1: Write the failing test** (`src/pages/SignalIssue.test.jsx`)

```jsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../lib/issues.js', () => ({
  getIssueBySlug: (slug) =>
    slug === 'first-light'
      ? {
          slug: 'first-light',
          title: 'First Light',
          publishedAt: '2026-06-20T00:00:00Z',
          excerpt: 'Teaser.',
          seo: {},
          body: [{ _type: 'block', style: 'normal', _key: '1', markDefs: [], children: [{ _type: 'span', _key: 's', text: 'Hello world', marks: [] }] }],
        }
      : undefined,
}))

const { default: SignalIssue } = await import('./SignalIssue.jsx')

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/signal/:slug" element={<SignalIssue />} />
        <Route path="/signal" element={<div>archive index</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SignalIssue page', () => {
  it('renders the issue title and body for a known slug', () => {
    renderAt('/signal/first-light')
    expect(screen.getByRole('heading', { level: 1, name: 'First Light' })).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('redirects to the archive for an unknown slug', () => {
    renderAt('/signal/does-not-exist')
    expect(screen.getByText('archive index')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:fe -- src/pages/SignalIssue.test.jsx`
Expected: FAIL — `./SignalIssue.jsx` not found.

- [ ] **Step 3: Write the page** (`src/pages/SignalIssue.jsx`)

```jsx
import { Link, Navigate, useParams } from 'react-router-dom'
import { getIssueBySlug } from '../lib/issues.js'
import IssueBody from '../components/IssueBody.jsx'
import usePageMeta from '../lib/usePageMeta.js'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function SignalIssue() {
  const { slug } = useParams()
  const issue = getIssueBySlug(slug)

  // Hooks must run unconditionally; compute meta from the issue (or fall back).
  usePageMeta({
    title: issue ? issue.seo?.title || issue.title : 'The Signal',
    description: issue ? issue.seo?.description || issue.excerpt : undefined,
    noindex: issue?.seo?.noIndex === true,
  })

  if (!issue) return <Navigate to="/signal" replace />

  return (
    <article className="signal-issue container">
      <header className="signal-issue-head">
        <p className="signal-issue-kicker">
          <Link to="/signal">The Signal</Link>
        </p>
        <h1>{issue.title}</h1>
        <time dateTime={issue.publishedAt ?? undefined}>{formatDate(issue.publishedAt)}</time>
      </header>
      <IssueBody value={issue.body} />
      <footer className="signal-issue-foot">
        <Link to="/signal" className="btn btn-ghost">
          All issues
        </Link>
      </footer>
    </article>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:fe -- src/pages/SignalIssue.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/SignalIssue.jsx src/pages/SignalIssue.test.jsx
git commit -m "feat(signal): /signal/:slug issue page"
```

---

### Task 7: Wire the routes into the app

**Files:**
- Modify: `src/App.jsx`
- Create: `src/App.signal.test.jsx`

**Interfaces:**
- Consumes: `Signal` (Task 5), `SignalIssue` (Task 6).
- Produces: `/signal` and `/signal/:slug` routes. They are **eager imports** (not `lazy`) because they are prerendered — lazy-loading a prerendered route hydrates through the Suspense fallback and flashes the server HTML away (see the existing comment in `App.jsx`).

- [ ] **Step 1: Write the failing test** (`src/App.signal.test.jsx`)

```jsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('./lib/issues.js', () => ({
  allIssues: [{ slug: 'first-light', title: 'First Light', publishedAt: '2026-06-20T00:00:00Z', excerpt: '', seo: {}, body: [] }],
  getIssueBySlug: () => undefined,
}))

const { default: App } = await import('./App.jsx')

describe('App routing — /signal', () => {
  it('renders the archive at /signal', () => {
    render(
      <MemoryRouter initialEntries={['/signal']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'The Signal' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:fe -- src/App.signal.test.jsx`
Expected: FAIL — no `/signal` route, redirects to `/`.

- [ ] **Step 3: Add the imports** (`src/App.jsx`, after the `Apply` import on line 8)

```jsx
import Signal from './pages/Signal.jsx'
import SignalIssue from './pages/SignalIssue.jsx'
```

- [ ] **Step 4: Add the routes** (`src/App.jsx`, inside `<Routes>`, after the `/apply` route)

```jsx
<Route path="/signal" element={<Signal />} />
<Route path="/signal/:slug" element={<SignalIssue />} />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:fe -- src/App.signal.test.jsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/App.signal.test.jsx
git commit -m "feat(signal): wire /signal and /signal/:slug routes"
```

---

### Task 8: Prerender + sitemap integration

**Files:**
- Modify: `scripts/prerender.mjs`

**Interfaces:**
- Consumes: `src/content/issues.generated.json` (read via `readFile`); the existing `Static` SSR entry; existing `injectHead`.
- Produces: `dist/signal.html` + one `dist/signal/<slug>.html` per published issue (each with content + per-page head); `dist/sitemap.xml` regenerated to include `/signal` and every issue URL.

- [ ] **Step 1: Extend `injectHead` to support image + og:type** (`scripts/prerender.mjs`)

In `injectHead`, after the `canonical` block (before `return out`), add:

```javascript
  if (image) {
    out = out.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${image}$2`)
    out = out.replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${image}$2`)
  }
  if (ogType) {
    out = out.replace(/(<meta property="og:type" content=")[^"]*(")/, `$1${ogType}$2`)
  }
```

And change the function signature destructuring from `{ title, description, canonical }` to:

```javascript
function injectHead(html, { title, description, canonical, image, ogType }) {
```

- [ ] **Step 2: Load published issues and append issue routes** (`scripts/prerender.mjs`)

After the `const ROUTES = [ ... ]` array literal (after its closing `]`), add:

```javascript
const SIGNAL_OG = `${SITE}/og.png`
const issues = JSON.parse(
  await readFile(new URL('../src/content/issues.generated.json', import.meta.url), 'utf8'),
)

// Archive index
ROUTES.push({
  path: '/signal',
  file: 'signal.html',
  expect: 'signal-archive',
  head: {
    title: 'The Signal — The Ground State Society',
    description:
      'The Signal — funding moves, ecosystem intel, and hard-won lessons for the people building the quantum economy. Free to read.',
    canonical: `${SITE}/signal`,
  },
})

// One page per published issue
for (const issue of issues) {
  ROUTES.push({
    path: `/signal/${issue.slug}`,
    file: `signal/${issue.slug}.html`,
    expect: 'signal-issue',
    head: {
      title: `${issue.seo?.title || issue.title} — The Ground State Society`,
      description: issue.seo?.description || issue.excerpt || '',
      canonical: `${SITE}/signal/${issue.slug}`,
      image: issue.seo?.ogImage ? `${issue.seo.ogImage}?w=1200&h=630&fit=crop&auto=format` : SIGNAL_OG,
      ogType: 'article',
    },
  })
}
```

- [ ] **Step 3: Ensure nested output directories exist before writing** (`scripts/prerender.mjs`)

The write loop currently does `await writeFile(new URL(\`../dist/${route.file}\`, ...))`. Issue files live under `dist/signal/`, which won't exist. Add `mkdir` import and create the parent dir per route. Change the top import line to include `mkdir`:

```javascript
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises'
```

And immediately before the `await writeFile(...)` call in the loop, add:

```javascript
  const outUrl = new URL(`../dist/${route.file}`, import.meta.url)
  await mkdir(new URL('.', outUrl), { recursive: true })
```

Then change the existing write to reuse `outUrl`:

```javascript
  await writeFile(outUrl, html)
```

- [ ] **Step 4: Generate the sitemap from the route list** (`scripts/prerender.mjs`)

After the `for (const route of ROUTES)` loop and before the final `rm(... dist-ssr ...)`, add:

```javascript
// Regenerate sitemap.xml from the routes we just prerendered (static routes +
// every published issue). The Amplify catch-all excludes .xml, so dist/sitemap.xml
// is served directly.
const sitemapEntries = [
  { loc: `${SITE}/`, priority: '1.0', changefreq: 'monthly' },
  { loc: `${SITE}/story`, priority: '0.7', changefreq: 'monthly' },
  { loc: `${SITE}/apply`, priority: '0.8', changefreq: 'monthly' },
  { loc: `${SITE}/signal`, priority: '0.8', changefreq: 'weekly' },
  ...issues
    .filter((i) => !i.seo?.noIndex)
    .map((i) => ({ loc: `${SITE}/signal/${i.slug}`, priority: '0.6', changefreq: 'monthly' })),
]
const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  sitemapEntries
    .map(
      (e) =>
        `  <url>\n    <loc>${e.loc}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
    )
    .join('\n') +
  '\n</urlset>\n'
await writeFile(new URL('../dist/sitemap.xml', import.meta.url), sitemap)
console.log(`prerender: sitemap.xml → ${sitemapEntries.length} urls`)
```

- [ ] **Step 5: Verify the full build prerenders the issue to static HTML**

First seed a real issue into the generated file so the build has content without needing Sanity creds locally. Write this exact fixture to `src/content/issues.generated.json`:

```json
[
  {
    "slug": "verify-fixture",
    "title": "Verify Fixture",
    "publishedAt": "2026-06-26T00:00:00Z",
    "excerpt": "A fixture issue to verify the prerender pipeline.",
    "seo": { "title": "Verify Fixture", "description": "A fixture issue to verify the prerender pipeline.", "ogImage": null, "noIndex": false },
    "body": [
      { "_type": "block", "style": "normal", "_key": "1", "markDefs": [], "children": [{ "_type": "span", "_key": "s", "text": "Settled in the ground state.", "marks": [] }] }
    ]
  }
]
```

Run: `SANITY_PROJECT_ID= npm run build`
(The empty `SANITY_PROJECT_ID` makes `fetch-issues.mjs` keep the fixture you just wrote rather than overwriting it — verify by reading its warning line. If your shell preserves an exported value, instead temporarily comment out the `node scripts/fetch-issues.mjs &&` prefix for this one run.)

Then verify the static output (no JS executed):

```bash
test -f dist/signal.html && echo "index OK"
test -f dist/signal/verify-fixture.html && echo "issue file OK"
grep -q "Settled in the ground state." dist/signal/verify-fixture.html && echo "issue PROSE in static HTML"
grep -q "<title>Verify Fixture — The Ground State Society</title>" dist/signal/verify-fixture.html && echo "issue TITLE injected"
grep -q "groundstatesociety.com/signal/verify-fixture" dist/sitemap.xml && echo "sitemap has issue"
```

Expected: all five echo lines print. If "issue PROSE in static HTML" fails, the `expect: 'signal-issue'` guard or the data-route render is wrong — fix before committing.

- [ ] **Step 6: Restore the empty seed and commit**

Reset the generated seed so the committed copy stays empty (production regenerates it):

```bash
printf '[]\n' > src/content/issues.generated.json
git add scripts/prerender.mjs src/content/issues.generated.json
git commit -m "feat(signal): prerender issue pages + regenerate sitemap"
```

---

### Task 9: Amplify rewrites + robots

**Files:**
- Modify: `infra/amplify-rewrites.json`
- Modify: `public/robots.txt` (only if it lacks a `Sitemap:` line)

**Interfaces:**
- Consumes: nothing.
- Produces: rewrite rules that serve the prerendered `/signal*` HTML; documented as a manual console paste.

- [ ] **Step 1: Add the `/signal` rules before the catch-all** (`infra/amplify-rewrites.json`)

Insert these two objects immediately **after** the `/apply` rule and **before** the catch-all regex object (order matters — the catch-all intercepts extensionless paths first):

```json
  {
    "source": "/signal",
    "target": "/signal.html",
    "status": "200",
    "condition": null
  },
  {
    "source": "/signal/<slug>",
    "target": "/signal/<slug>.html",
    "status": "200",
    "condition": null
  },
```

- [ ] **Step 2: Confirm robots.txt references the sitemap**

Run: `grep -i sitemap public/robots.txt`
Expected: a line `Sitemap: https://groundstatesociety.com/sitemap.xml`. If absent, append it.

- [ ] **Step 3: Validate the JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('infra/amplify-rewrites.json','utf8')); console.log('valid')"`
Expected: `valid`.

- [ ] **Step 4: Commit**

```bash
git add infra/amplify-rewrites.json public/robots.txt
git commit -m "feat(signal): Amplify rewrites for /signal archive + issue pages"
```

- [ ] **Step 5: Apply in the Amplify console (manual, post-merge)**

In the Amplify console → App settings → Rewrites and redirects → open the JSON editor → paste the full contents of `infra/amplify-rewrites.json` → Save. (Rewrites are not auto-deployed; this is the same manual step used for `/story` and `/apply`.) Note this in the PR description so it is not missed.

---

### Task 10: Publish-to-rebuild webhook

**Files:**
- Create: `docs/runbooks/signal-publish-webhook.md`

**Interfaces:**
- Consumes: the Amplify app; the Sanity project.
- Produces: publishing an `issue` in Sanity triggers an Amplify build that regenerates the static archive.

- [ ] **Step 1: Create an Amplify incoming build webhook**

In the Amplify console → App settings → Build settings → Incoming webhooks → Create webhook (name `sanity-issue-publish`, branch `main`). Copy the generated URL (form `https://webhooks.amplify.<region>.amazonaws.com/prod/webhooks?id=...&token=...&operation=startbuild`). Treat the URL as a secret.

- [ ] **Step 2: Create the Sanity GROQ-powered webhook**

In Sanity Manage → API → Webhooks → Create webhook:
- Name: `Amplify rebuild on issue publish`
- URL: the Amplify incoming webhook URL from Step 1
- Dataset: `production`
- Trigger on: Create, Update, Delete
- Filter: `_type == "issue"`
- HTTP method: `POST`
- Projection: leave default (Amplify ignores the body)

- [ ] **Step 3: Document the wiring** (`docs/runbooks/signal-publish-webhook.md`)

Write a short runbook: what the webhook does, where the two endpoints live, that the Amplify URL is a secret, and the manual rebuild fallback (`Amplify console → Redeploy this version`). Note the filter (`_type == "issue"`) and that draft autosaves do not publish (only the Publish action mutates the published doc that the build query reads).

- [ ] **Step 4: Verify end-to-end**

In the deployed Studio, change a published issue's title and Publish. Confirm a new build starts in the Amplify console within ~1 minute. After it completes, load the live issue URL and confirm the new title.

- [ ] **Step 5: Commit**

```bash
git add docs/runbooks/signal-publish-webhook.md
git commit -m "docs(signal): publish-to-rebuild webhook runbook"
```

---

### Task 11: Full-suite check + live verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test:fe && npm test`
Expected: all frontend (vitest) and backend (node --test) suites green.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Live verification (per the spec's "run the real thing" rule)**

After merge + deploy + applying the rewrites (Task 9 Step 5):
- Load `https://groundstatesociety.com/signal` — the archive lists the real published issue(s).
- Click through to `/signal/<slug>` — the issue renders.
- `curl -s https://groundstatesociety.com/signal/<slug> | grep "<a-known-sentence>"` — the prose is in the **raw HTML** (proves crawler/AEO visibility, not just hydrated render).
- `curl -s https://groundstatesociety.com/sitemap.xml | grep signal` — the issue URL is in the sitemap.
- Publish a tweak in Sanity → confirm the webhook rebuilds and the change goes live.
- Request indexing for the issue URL in Google Search Console.

Record the results in the PR. Mocked data and green unit tests are not sufficient evidence that the archive is live and indexable.

---

## Self-Review

**Spec coverage (against `2026-06-26-signal-newsletter-design.md`):**
- §5 Sanity content model (`issue` + reusable `seo` + `pteImage`) → Task 1. ✓
- §6 routes `/signal` + `/signal/<slug>` → Tasks 5, 6, 7. ✓
- §6 prerender integration (build-time GROQ → static HTML, head injection, expect-marker guard, stega-off via build-time fetch) → Tasks 2, 8. ✓
- §6 sitemap + Amplify rewrites → Tasks 8, 9. ✓
- §6 publish→rebuild webhook → Task 10. ✓
- §6 per-issue SEO (title/description/canonical/OG image, og:type=article) → Task 8. ✓
- §9 verification (static-HTML/curl proof, live publish round-trip) → Tasks 8, 11. ✓
- Global "no Sanity client/token in browser" constraint → Task 2 design (Node-only fetch → bundled JSON). ✓
- Deferred to Phase B (correctly absent here): email rendering, Postmark Broadcast, recipients, unsubscribe. ✓
- JSON-LD `BlogPosting` per issue: spec §10 lists it as "recommended, confirm in planning." **Deferred** — not blocking the indexable-archive goal; can be a fast-follow once the page ships. Noted, not silently dropped.

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N" — every code step contains complete code and every command has expected output. ✓

**Type/name consistency:** `normalizeIssues` (Task 2) → `issues.generated.json` shape → `allIssues`/`getIssueBySlug` (Task 3) → consumed with the same field names by `IssueBody` (Task 4), `Signal` (Task 5), `SignalIssue` (Task 6), and `prerender.mjs` (Task 8). `expect` markers `signal-archive` / `signal-issue` match the class names rendered by Tasks 5/6 and asserted by Task 8. ✓

---

## Execution Handoff

**Phase A plan complete. Two execution options:**

**1. Subagent-Driven (recommended)** — a fresh subagent per task, two-stage review between tasks, fast iteration. Note: Task 1 (Sanity project creation, Studio deploy) and Task 10 (Amplify/Sanity console webhook) involve interactive logins and console steps you'll likely run yourself.

**2. Inline Execution** — execute tasks in this session via executing-plans, with checkpoints for review.

Which approach?
