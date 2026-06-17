export function buildSessionCookie(value) {
  const domain = process.env.COOKIE_DOMAIN || '.altivum.ai'
  const maxAge = process.env.SESSION_TTL_SEC || '2592000'
  return `session=${value}; HttpOnly; Secure; SameSite=Lax; Domain=${domain}; Path=/; Max-Age=${maxAge}`
}

export function parseCookies(event) {
  const out = {}
  for (const c of event?.cookies ?? []) {
    const i = c.indexOf('=')
    if (i > 0) out[c.slice(0, i)] = c.slice(i + 1)
  }
  return out
}
