import { afterEach, describe, expect, it, vi } from 'vitest'
import { postJson, requestJson } from './submit.js'

// Minimal fetch-Response stand-ins — submit.js only touches res.ok / res.status / res.json().
const okJson = (data) => ({ ok: true, status: 200, json: async () => data })
const fail = (status) => ({ ok: false, status, json: async () => ({}) })

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('postJson / requestJson — HTTPS transport guard', () => {
  it('postJson rejects a non-HTTPS, non-localhost endpoint before sending', async () => {
    globalThis.fetch = vi.fn()
    await expect(postJson('http://evil.example.com', { a: 1 })).rejects.toThrow(/https/i)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('requestJson rejects a non-HTTPS, non-localhost endpoint before sending', async () => {
    globalThis.fetch = vi.fn()
    await expect(requestJson('http://evil.example.com', { a: 1 })).rejects.toThrow(/https/i)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('allows http://localhost for local development', async () => {
    globalThis.fetch = vi.fn(async () => okJson({ ok: 1 }))
    await expect(requestJson('http://localhost:8787/checkout', { plan: 'monthly' })).resolves.toEqual({
      ok: 1,
    })
  })
})

describe('requestJson — method selection and parsing', () => {
  it('uses GET (no body/content-type) when payload is omitted', async () => {
    globalThis.fetch = vi.fn(async () => okJson({ status: 'complete' }))
    const out = await requestJson('https://api.example.com/session?session_id=cs_test_x')
    const [, opts] = globalThis.fetch.mock.calls[0]
    expect(opts.method).toBe('GET')
    expect(opts.body).toBeUndefined()
    expect(out).toEqual({ status: 'complete' })
  })

  it('POSTs a JSON body when a payload is provided', async () => {
    globalThis.fetch = vi.fn(async () => okJson({ url: 'https://checkout.stripe.com/c/pay/x' }))
    await requestJson('https://api.example.com/checkout', { plan: 'annual' })
    const [, opts] = globalThis.fetch.mock.calls[0]
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(opts.body)).toEqual({ plan: 'annual' })
  })

  it('throws on a non-2xx response, attaching the status', async () => {
    globalThis.fetch = vi.fn(async () => fail(500))
    await expect(requestJson('https://api.example.com', { a: 1 })).rejects.toMatchObject({
      message: expect.stringMatching(/500/),
      status: 500,
    })
  })
})

describe('postJson — success and error mapping', () => {
  it('resolves true on a 2xx response', async () => {
    globalThis.fetch = vi.fn(async () => okJson({}))
    await expect(postJson('https://api.example.com', { form: 'signal' })).resolves.toBe(true)
  })

  it('throws on a non-2xx response, attaching the status', async () => {
    globalThis.fetch = vi.fn(async () => fail(429))
    await expect(postJson('https://api.example.com', { a: 1 })).rejects.toMatchObject({
      message: expect.stringMatching(/429/),
      status: 429,
    })
  })
})

describe('AbortController timeout', () => {
  it('aborts the request after timeoutMs', async () => {
    vi.useFakeTimers()
    let captured
    globalThis.fetch = vi.fn((_url, opts) => {
      captured = opts.signal
      return new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        )
      })
    })
    const pending = postJson('https://api.example.com', { a: 1 }, { timeoutMs: 1000 })
    const assertion = expect(pending).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
    expect(captured.aborted).toBe(true)
  })
})
