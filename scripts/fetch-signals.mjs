/*
 * Build-time normalizer for the Proof section's market signals — the same
 * source→generated pattern as fetch-issues.mjs, for the same reason: the
 * numbers the credibility pitch rests on must be validated and dated at
 * build time, loudly, in the Amplify log — not left to decay silently in a
 * component literal. Runs SECOND in `npm run build` (after fetch-issues).
 *
 * The source of truth is the editor-maintained src/content/signals.source.json.
 * normalizeSignals owns every derivation (stat display strings, the VC growth
 * multiple, the "as of" display date), so components and figures consume one
 * pre-computed shape and cannot drift from the source values.
 *
 * Staleness is a guarded failure mode, mirroring the fetch-issues discipline:
 * "Receipts, not vibes" claims dated data — past ~6 months the build WARNS,
 * past a year it FAILS unless GSS_ALLOW_STALE_SIGNALS=1 explicitly accepts
 * shipping year-old market claims.
 */
import { pathToFileURL } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'

const SRC = new URL('../src/content/signals.source.json', import.meta.url)
const OUT = new URL('../src/content/signals.generated.json', import.meta.url)

const WARN_AFTER_DAYS = 190 // ~6 months — nag every build
const FAIL_AFTER_DAYS = 366 // a year — refuse to claim "receipts"

const CELL_VALUES = new Set(['yes', 'no', 'partial'])

/* Structural validation + derivations. Throws on malformed source — a build
   must never ship a half-formed Proof section. */
export function normalizeSignals(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('fetch-signals: source is not an object')
  }
  const problems = []

  if (typeof raw.asOf !== 'string' || Number.isNaN(Date.parse(raw.asOf))) {
    problems.push(`asOf ${JSON.stringify(raw.asOf)} is not a parseable date`)
  }

  if (!Array.isArray(raw.stats) || raw.stats.length === 0) {
    problems.push('stats must be a non-empty array')
  }
  const stats = (raw.stats ?? []).map((s, i) => {
    const c = s?.count
    if (!c || Number.isNaN(parseFloat(c.n))) {
      problems.push(`stats[${i}] count.n ${JSON.stringify(c?.n)} is not numeric`)
    }
    if (!s?.label) problems.push(`stats[${i}] is missing a label`)
    if (!s?.source) problems.push(`stats[${i}] is missing a source`)
    return {
      ...s,
      // The single owner of the display derivation (was statValue() in
      // Proof.jsx) — the static fallback and the counter target can't drift.
      display: `${c?.prefix ?? ''}${c?.n ?? ''}${c?.suffix ?? ''}`,
    }
  })

  const vc = raw.funding?.vc
  if (!Array.isArray(vc) || vc.length < 2) {
    problems.push('funding.vc needs at least two {year, usdB} points')
  }
  for (const p of vc ?? []) {
    if (!Number.isFinite(p?.year) || !Number.isFinite(p?.usdB)) {
      problems.push(`funding.vc point ${JSON.stringify(p)} is malformed`)
    }
  }
  const market = raw.funding?.market
  if (
    !market ||
    ![market.fromYear, market.fromUsdB, market.toYear, market.toUsdB].every(Number.isFinite)
  ) {
    problems.push('funding.market must carry numeric fromYear/fromUsdB/toYear/toUsdB')
  }

  const conc = raw.concentration
  if (!conc || !Number.isFinite(conc.sharePct) || conc.sharePct < 0 || conc.sharePct > 100) {
    problems.push('concentration.sharePct must be a number in [0, 100]')
  }

  if (!Array.isArray(raw.networks) || raw.networks.length === 0) {
    problems.push('networks must be a non-empty array')
  }
  for (const n of raw.networks ?? []) {
    if (!n?.name || !n?.price || !Number.isFinite(n?.priceUsd)) {
      problems.push(`network ${JSON.stringify(n?.name)} needs name, price, numeric priceUsd`)
    }
  }
  if (!raw.us?.name || !Number.isFinite(raw.us?.priceUsd)) {
    problems.push('us must carry name and numeric priceUsd')
  }

  const columns = raw.matrix?.columns
  const rows = raw.matrix?.rows
  if (!Array.isArray(columns) || columns.length === 0) {
    problems.push('matrix.columns must be a non-empty array')
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    problems.push('matrix.rows must be a non-empty array')
  }
  for (const row of rows ?? []) {
    if (!row?.attr) problems.push('a matrix row is missing attr')
    if (!Array.isArray(row?.cells) || row.cells.length !== (columns?.length ?? 0)) {
      problems.push(`matrix row ${JSON.stringify(row?.attr)} has ${row?.cells?.length ?? 0} cells, expected ${columns?.length}`)
    }
    for (const cell of row?.cells ?? []) {
      if (!CELL_VALUES.has(cell)) {
        problems.push(`matrix row ${JSON.stringify(row?.attr)} has invalid cell ${JSON.stringify(cell)}`)
      }
    }
  }

  if (problems.length) {
    throw new Error(`fetch-signals: source is malformed:\n  - ${problems.join('\n  - ')}`)
  }

  const sortedVc = [...vc].sort((a, b) => a.year - b.year)
  const first = sortedVc[0]
  const last = sortedVc[sortedVc.length - 1]

  return {
    asOf: raw.asOf,
    // "July 2026" — one derivation, used by the section stamp.
    asOfDisplay: new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(raw.asOf)),
    stats,
    funding: {
      ...raw.funding,
      vc: sortedVc,
      // ×2.05 — derived once, so the figure annotation can't contradict the
      // data. Two decimals max, trailing zeros dropped: 4.1/2.0 must read
      // "2.05" (toFixed(1) floats it down to a false "2.0").
      multiple: last.usdB / first.usdB,
      multipleDisplay: String(Math.round((last.usdB / first.usdB) * 100) / 100),
    },
    concentration: raw.concentration,
    networks: raw.networks,
    us: raw.us,
    matrix: raw.matrix,
  }
}

/* Freshness guard — pure + injectable clock for tests. */
export function guardStaleSignals(signals, env = process.env, now = new Date()) {
  const ageDays = (now.getTime() - Date.parse(signals.asOf)) / 86_400_000
  if (ageDays > FAIL_AFTER_DAYS) {
    if (env.GSS_ALLOW_STALE_SIGNALS !== '1') {
      throw new Error(
        `fetch-signals: signals.source.json is ${Math.round(ageDays)} days old (asOf ${signals.asOf}). ` +
          '"Receipts, not vibes" cannot ship year-old market claims — refresh the source data ' +
          '(and its asOf date), or set GSS_ALLOW_STALE_SIGNALS=1 to ship it anyway.',
      )
    }
    console.warn(
      `fetch-signals: shipping ${Math.round(ageDays)}-day-old signals under GSS_ALLOW_STALE_SIGNALS=1 — refresh soon`,
    )
    return
  }
  if (ageDays > WARN_AFTER_DAYS) {
    console.warn(
      `fetch-signals: signals.source.json is ${Math.round(ageDays)} days old (asOf ${signals.asOf}) — ` +
        `the Proof section stamps this date; consider refreshing (hard failure at ${FAIL_AFTER_DAYS} days)`,
    )
  }
}

async function main() {
  const raw = JSON.parse(await readFile(SRC, 'utf8'))
  const signals = normalizeSignals(raw)
  guardStaleSignals(signals)
  await writeFile(OUT, JSON.stringify(signals, null, 2) + '\n')
  console.log(
    `fetch-signals: wrote ${signals.stats.length} stats, ${signals.networks.length} networks, ` +
      `${signals.matrix.rows.length} matrix rows (as of ${signals.asOf}) → src/content/signals.generated.json`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((err) => {
    console.error('fetch-signals: failed', err)
    process.exit(1)
  })
}
