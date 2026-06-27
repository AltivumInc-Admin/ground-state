/*
 * Reconcile the CSP connect-src with the endpoints the app is actually built to
 * call. Every intake endpoint is injected at build time from a VITE_*_ENDPOINT
 * env var, but the enforcing connect-src in customHttp.yml is a hand-maintained
 * allowlist — if a configured host isn't covered, the browser silently blocks
 * the fetch and the form reports a generic error indistinguishable from a network
 * blip (the imminent /apply paid funnel is the highest-stakes case). This guard
 * fails the build instead, replacing the "ADD THE APPLY ORIGIN HERE" comment with
 * an enforced check. Runs in the Amplify preBuild where the real VITE_* env lives.
 */
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

/** Extract the connect-src origin tokens from a customHttp.yml string. Anchored
 *  on the `key: 'Content-Security-Policy'` line + its quoted `value:` so the word
 *  "connect-src" appearing in a nearby comment can't be mistaken for the directive. */
export function parseConnectSrc(customHttpYml) {
  const csp = customHttpYml.match(/key:\s*'Content-Security-Policy'\s*\n\s*value:\s*"([^"]*)"/)
  if (!csp) throw new Error('check-csp: Content-Security-Policy value not found in customHttp.yml')
  const directive = csp[1].match(/connect-src ([^;]*)/)
  if (!directive) throw new Error('check-csp: connect-src directive not found in the CSP value')
  return directive[1].trim().split(/\s+/).filter(Boolean)
}

/** Does an allowlist cover an origin, by exact match or a single-label wildcard? */
export function originAllowed(origin, allowList) {
  for (const a of allowList) {
    if (a === origin) return true
    if (a.includes('*')) {
      const re = new RegExp('^' + a.replace(/[.]/g, '\\.').replace(/\*/g, '[^.]+') + '$')
      if (re.test(origin)) return true
    }
  }
  return false
}

/** Returns an array of problem strings; empty means every endpoint is covered. */
export function checkCsp(customHttpYml, env) {
  const allow = parseConnectSrc(customHttpYml)
  const problems = []
  for (const [key, val] of Object.entries(env)) {
    if (!/^VITE_.*ENDPOINT$/.test(key) || !val) continue
    let origin
    try {
      origin = new URL(val).origin
    } catch {
      problems.push(`${key}=${val} is not a valid URL`)
      continue
    }
    // localhost dev endpoints are not subject to the production CSP
    if (/^https?:\/\/localhost(:|$)/.test(origin)) continue
    if (!originAllowed(origin, allow)) {
      problems.push(`${key} origin ${origin} is not covered by connect-src (${allow.join(' ')})`)
    }
  }
  return problems
}

async function main() {
  const yml = await readFile(new URL('../customHttp.yml', import.meta.url), 'utf8')
  const problems = checkCsp(yml, process.env)
  if (problems.length) {
    console.error('check-csp: FAIL — connect-src does not cover every configured endpoint:')
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  console.log('check-csp: OK — every configured VITE_*_ENDPOINT origin is allowed by connect-src.')
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
