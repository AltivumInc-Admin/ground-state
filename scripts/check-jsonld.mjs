/*
 * Validate the hand-maintained JSON-LD @graph in index.html. The ~88-line block
 * is edited by hand and threaded with @id cross-references (founder,
 * parentOrganization, publisher, hasOfferCatalog, …). A single trailing comma,
 * unescaped quote, or dangling @id makes the whole block invalid and search
 * engines silently discard ALL structured data — with no build error. This guard
 * turns that into a hard failure.
 *
 * Exposed as pure functions (testable) plus a main() that checks the real
 * index.html; it runs in the gate via scripts/check-jsonld.test.mjs (and so in
 * both CI and the Amplify preBuild that run `npm test`).
 */
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const SCRIPT_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/

/** Extract the ld+json block body from an HTML string (throws if absent). */
export function extractJsonLd(html) {
  const m = html.match(SCRIPT_RE)
  if (!m) throw new Error('check-jsonld: no <script type="application/ld+json"> block found')
  return m[1]
}

/**
 * Parse the JSON-LD and assert referential integrity: every `{ "@id": "…" }`
 * pointer (an object with @id but no @type) resolves to a node (an object with
 * both @type and @id) declared somewhere in the graph. Throws on malformed JSON
 * or a dangling reference. Returns a small summary on success.
 */
export function validateJsonLd(jsonString) {
  let data
  try {
    data = JSON.parse(jsonString)
  } catch (err) {
    throw new Error(`check-jsonld: JSON-LD is not valid JSON — ${err.message}`)
  }

  const graph = Array.isArray(data['@graph']) ? data['@graph'] : [data]
  const nodes = new Set()
  const refs = new Set()

  const walk = (n) => {
    if (Array.isArray(n)) {
      n.forEach(walk)
      return
    }
    if (!n || typeof n !== 'object') return
    if (typeof n['@id'] === 'string') {
      // A node declaration carries @type; a bare { "@id": … } is a pointer.
      if ('@type' in n) nodes.add(n['@id'])
      else refs.add(n['@id'])
    }
    for (const v of Object.values(n)) {
      if (v && typeof v === 'object') walk(v)
    }
  }
  walk(graph)

  const dangling = [...refs].filter((id) => !nodes.has(id))
  if (dangling.length) {
    throw new Error(
      `check-jsonld: dangling @id reference(s) with no matching node: ${dangling.join(', ')}`,
    )
  }
  return { nodes: nodes.size, refs: refs.size }
}

async function main() {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  const { nodes } = validateJsonLd(extractJsonLd(html))
  console.log(`check-jsonld: OK — ${nodes} @graph node(s), all @id references resolve.`)
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
