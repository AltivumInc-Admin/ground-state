import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseConnectSrc, originAllowed, checkCsp } from './check-csp.mjs'

const YML = `customHeaders:
  - pattern: '**'
    headers:
      - key: 'Content-Security-Policy'
        value: "default-src 'self'; connect-src 'self' https://api.groundstatesociety.com https://*.execute-api.us-east-2.amazonaws.com; img-src 'self' data:"
`

test('parseConnectSrc extracts the connect-src origins', () => {
  assert.deepEqual(parseConnectSrc(YML), [
    "'self'",
    'https://api.groundstatesociety.com',
    'https://*.execute-api.us-east-2.amazonaws.com',
  ])
})

test('originAllowed matches exact host and single-label wildcard', () => {
  const allow = ['https://api.groundstatesociety.com', 'https://*.execute-api.us-east-2.amazonaws.com']
  assert.equal(originAllowed('https://api.groundstatesociety.com', allow), true)
  assert.equal(originAllowed('https://abc123.execute-api.us-east-2.amazonaws.com', allow), true)
  assert.equal(originAllowed('https://evil.com', allow), false)
  // wildcard is single-label: a different region must not match
  assert.equal(originAllowed('https://abc.execute-api.us-east-1.amazonaws.com', allow), false)
})

test('checkCsp passes when every configured endpoint is covered', () => {
  const problems = checkCsp(YML, {
    VITE_SIGNAL_ENDPOINT: 'https://api.groundstatesociety.com/subscribe',
    VITE_CHECKOUT_ENDPOINT: 'https://abc123.execute-api.us-east-2.amazonaws.com',
  })
  assert.deepEqual(problems, [])
})

test('checkCsp flags an endpoint origin not in connect-src', () => {
  const problems = checkCsp(YML, { VITE_APPLY_ENDPOINT: 'https://forms.example.com/apply' })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /VITE_APPLY_ENDPOINT origin https:\/\/forms\.example\.com is not covered/)
})

test('checkCsp ignores unset endpoints and localhost dev endpoints', () => {
  const problems = checkCsp(YML, {
    VITE_APPLY_ENDPOINT: '',
    VITE_CHECKOUT_ENDPOINT: 'http://localhost:8787',
  })
  assert.deepEqual(problems, [])
})
