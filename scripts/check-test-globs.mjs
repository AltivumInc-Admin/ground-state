/*
 * Pretest guard: `node --test` with a glob that matches zero files exits 0
 * ("tests 0 / pass 0 / fail 0") — a silent success that voids the deploy gate
 * if a test directory is ever renamed or moved. This asserts every directory
 * the `test` script globs actually contains at least one *.test.mjs, turning an
 * empty match into a hard, build-blocking failure. Runs automatically before
 * `npm test` via the npm `pretest` lifecycle hook.
 */
import { readdirSync } from 'node:fs'

// Keep in lockstep with the globs in package.json's `test` script.
const TEST_DIRS = [
  'backend/checkout/test',
  'backend/subscribe/test',
  'backend/broadcast/test',
  'scripts', // scripts/*.test.mjs (e.g. fetch-issues.test.mjs)
  'scripts/lib', // scripts/lib/*.test.mjs (e.g. inject-head.test.mjs)
]

let ok = true
for (const dir of TEST_DIRS) {
  let count = 0
  try {
    count = readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).length
  } catch (err) {
    console.error(`check-test-globs: cannot read ${dir} — ${err.code ?? err.message}`)
    ok = false
    continue
  }
  if (count === 0) {
    console.error(`check-test-globs: no *.test.mjs in ${dir} — its test glob would silently match nothing`)
    ok = false
  }
}

if (!ok) {
  console.error(
    'check-test-globs: FAIL — a test directory is empty or missing; the gate would otherwise pass with zero coverage there.',
  )
  process.exit(1)
}
console.log(`check-test-globs: OK — all ${TEST_DIRS.length} test directories contain tests.`)
