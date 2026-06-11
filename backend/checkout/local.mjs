/*
 * Local harness — wraps the Lambda handler in a plain HTTP server so the
 * Vite dev server can talk to it exactly like the deployed API.
 *
 * Run from the repo root (reads Stripe keys from .env.local):
 *   node --env-file=.env.local backend/checkout/local.mjs
 */

// The deployed function gets these from CloudFormation parameters; locally
// we map them from the names .env.local already uses. Must happen before
// the handler module is imported.
process.env.PRICE_MONTHLY ||= process.env.VITE_STRIPE_PRICE_ROUND_MONTHLY
process.env.PRICE_ANNUAL ||= process.env.VITE_STRIPE_PRICE_ROUND_ANNUAL
process.env.SITE_URL ||= 'http://localhost:5173'

const { createServer } = await import('node:http')
const { handler } = await import('./src/handler.mjs')

const PORT = 8787
// In production CORS is API Gateway's job; locally the harness emulates it
const CORS = {
  'access-control-allow-origin': 'http://localhost:5173',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    return res.end()
  }
  const chunks = []
  for await (const c of req) chunks.push(c)
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const event = {
    rawPath: url.pathname,
    requestContext: { http: { method: req.method } },
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(',') : v]),
    ),
    queryStringParameters: Object.fromEntries(url.searchParams),
    body: Buffer.concat(chunks).toString('utf8'),
    isBase64Encoded: false,
  }
  const out = await handler(event)
  res.writeHead(out.statusCode, { ...out.headers, ...CORS })
  res.end(out.body)
}).listen(PORT, () => {
  console.log(`checkout backend listening on http://localhost:${PORT}`)
})
