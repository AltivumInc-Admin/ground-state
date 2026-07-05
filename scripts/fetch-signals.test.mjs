import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { normalizeSignals, guardStaleSignals } from './fetch-signals.mjs'

const goodSource = async () =>
  JSON.parse(await readFile(new URL('../src/content/signals.source.json', import.meta.url), 'utf8'))

test('normalizeSignals derives stat display strings from count parts', async () => {
  const out = normalizeSignals(await goodSource())
  const first = out.stats[0]
  assert.equal(first.display, `${first.count.prefix}${first.count.n}${first.count.suffix}`)
  // The committed source's headline stat
  assert.equal(out.stats[0].display, '$4.1B')
})

test('normalizeSignals derives the VC growth multiple from the series', async () => {
  const out = normalizeSignals(await goodSource())
  assert.equal(out.funding.multipleDisplay, '2.05')
  // series is sorted ascending by year regardless of source order
  const years = out.funding.vc.map((p) => p.year)
  assert.deepEqual(years, [...years].sort((a, b) => a - b))
})

test('normalizeSignals derives the as-of display date', async () => {
  const out = normalizeSignals(await goodSource())
  assert.match(out.asOfDisplay, /^[A-Z][a-z]+ \d{4}$/)
})

test('normalizeSignals throws on a malformed matrix cell', async () => {
  const src = await goodSource()
  src.matrix.rows[0].cells[1] = 'maybe'
  assert.throws(() => normalizeSignals(src), /invalid cell "maybe"/)
})

test('normalizeSignals throws when a row has the wrong cell count', async () => {
  const src = await goodSource()
  src.matrix.rows[2].cells = ['yes']
  assert.throws(() => normalizeSignals(src), /has 1 cells, expected 3/)
})

test('normalizeSignals throws on a non-numeric stat', async () => {
  const src = await goodSource()
  src.stats[0].count.n = 'lots'
  assert.throws(() => normalizeSignals(src), /not numeric/)
})

test('normalizeSignals throws on a missing network price', async () => {
  const src = await goodSource()
  delete src.networks[0].priceUsd
  assert.throws(() => normalizeSignals(src), /needs name, price, numeric priceUsd/)
})

test('guardStaleSignals passes fresh data silently', () => {
  const now = new Date('2026-08-01T00:00:00Z')
  guardStaleSignals({ asOf: '2026-07-05' }, {}, now) // must not throw
})

test('guardStaleSignals warns past ~6 months (no throw)', () => {
  const warnings = []
  const original = console.warn
  console.warn = (msg) => warnings.push(msg)
  try {
    guardStaleSignals({ asOf: '2026-01-01' }, {}, new Date('2026-08-01T00:00:00Z'))
  } finally {
    console.warn = original
  }
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /days old/)
})

test('guardStaleSignals fails hard past a year', () => {
  assert.throws(
    () => guardStaleSignals({ asOf: '2025-06-01' }, {}, new Date('2026-08-01T00:00:00Z')),
    /cannot ship year-old market claims/,
  )
})

test('guardStaleSignals stale-but-flagged ships with a warning', () => {
  const warnings = []
  const original = console.warn
  console.warn = (msg) => warnings.push(msg)
  try {
    guardStaleSignals(
      { asOf: '2025-06-01' },
      { GSS_ALLOW_STALE_SIGNALS: '1' },
      new Date('2026-08-01T00:00:00Z'),
    )
  } finally {
    console.warn = original
  }
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /GSS_ALLOW_STALE_SIGNALS/)
})
