import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.COOKIE_DOMAIN = '.altivum.ai'
process.env.SESSION_TTL_SEC = '2592000'

const { buildSessionCookie, parseCookies } = await import('../src/cookies.mjs')

test('buildSessionCookie sets the security attributes', () => {
  const c = buildSessionCookie('abc.def')
  assert.match(c, /^session=abc\.def;/)
  assert.match(c, /HttpOnly/)
  assert.match(c, /Secure/)
  assert.match(c, /SameSite=Lax/)
  assert.match(c, /Domain=\.altivum\.ai/)
  assert.match(c, /Path=\//)
  assert.match(c, /Max-Age=2592000/)
})

test('parseCookies reads the payload-v2 cookies array', () => {
  assert.deepEqual(parseCookies({ cookies: ['session=abc', 'theme=dark'] }), {
    session: 'abc',
    theme: 'dark',
  })
  assert.deepEqual(parseCookies({}), {})
})
