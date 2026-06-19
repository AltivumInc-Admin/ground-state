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
    cookies: (req.headers.cookie ?? '').split('; ').filter(Boolean),
    body: Buffer.concat(chunks).toString('utf8') || undefined,
  }
  const result = await handler(event)
  // Local CORS for the Vite dev origin (the deployed API uses CorsConfiguration).
  res.setHeader('access-control-allow-origin', req.headers.origin ?? '*')
  res.setHeader('access-control-allow-credentials', 'true')
  for (const c of result.cookies ?? []) res.appendHeader('set-cookie', c)
  res.writeHead(result.statusCode, result.headers)
  res.end(result.body)
}).listen(PORT, () => console.log(`subscribe handler on http://localhost:${PORT}`))
