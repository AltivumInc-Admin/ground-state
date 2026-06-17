import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.TOKEN_PEPPER = 'pepper_test'
process.env.SESSION_SECRET = 'session_test'

const { generateToken, hashToken, signSession, verifySession, safeEqualHex } =
  await import('../src/crypto.mjs')

test('generateToken returns distinct url-safe strings', () => {
  const a = generateToken()
  const b = generateToken()
  assert.notEqual(a, b)
  assert.match(a, /^[A-Za-z0-9_-]+$/)
  assert.ok(a.length >= 40)
})

test('hashToken is deterministic and pepper-bound, never the raw token', () => {
  const t = generateToken()
  assert.equal(hashToken(t), hashToken(t))
  assert.notEqual(hashToken(t), t)
  assert.match(hashToken(t), /^[0-9a-f]{64}$/)
})

test('signSession round-trips and rejects tampering', () => {
  const value = signSession({ sub: 'abc', jti: 'j1', exp: Math.floor(Date.now() / 1000) + 60 })
  const payload = verifySession(value)
  assert.equal(payload.sub, 'abc')
  assert.equal(verifySession(value + 'x'), null)
  assert.equal(verifySession('garbage'), null)
})

test('verifySession rejects an expired session', () => {
  const value = signSession({ sub: 'abc', jti: 'j1', exp: Math.floor(Date.now() / 1000) - 1 })
  assert.equal(verifySession(value), null)
})

test('safeEqualHex compares by value, length-safe', () => {
  assert.equal(safeEqualHex('aa', 'aa'), true)
  assert.equal(safeEqualHex('aa', 'ab'), false)
  assert.equal(safeEqualHex('aa', 'aaaa'), false)
})
