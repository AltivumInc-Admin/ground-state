/*
 * Local harness — wraps the Lambda handler in a plain HTTP server so the
 * Vite dev server can talk to it exactly like the deployed API.
 *
 * Run from the repo root:
 *   node --env-file=.env.local backend/apply/local.mjs
 */
import { createServer } from 'node:http'
import { handler } from './src/handler.mjs'

const PORT = 8789
// In production CORS is API Gateway's job; locally the harness emulates it —
// including the OPTIONS preflight the browser sends before the JSON POST
// (without it the real form can't reach this harness at all).
const CORS = {
  'access-control-allow-origin': 'http://localhost:5173',
  'access-control-allow-methods': 'POST,OPTIONS',
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
    requestContext: { http: { method: req.method, sourceIp: '127.0.0.1' } },
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(',') : v]),
    ),
    body: Buffer.concat(chunks).toString('utf8') || undefined,
  }
  const result = await handler(event)
  res.writeHead(result.statusCode, { ...result.headers, ...CORS })
  res.end(result.body)
}).listen(PORT, () => console.log(`apply handler on http://localhost:${PORT}`))
