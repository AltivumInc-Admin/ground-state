import { createServer } from 'node:http'
import { handler } from './src/handler.mjs'

const PORT = 8788

createServer(async (req, res) => {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const event = {
    rawPath: url.pathname,
    requestContext: { http: { method: req.method, sourceIp: '127.0.0.1' } },
    headers: req.headers,
    body: Buffer.concat(chunks).toString('utf8') || undefined,
  }
  const result = await handler(event)
  // Local CORS for the Vite dev origin (the deployed API uses CorsConfiguration).
  // Bearer-token API — no cookies, no credentials (the cookie-session design
  // this harness once mirrored was abandoned before launch).
  res.setHeader('access-control-allow-origin', req.headers.origin ?? '*')
  res.writeHead(result.statusCode, result.headers)
  res.end(result.body)
}).listen(PORT, () => console.log(`subscribe handler on http://localhost:${PORT}`))
