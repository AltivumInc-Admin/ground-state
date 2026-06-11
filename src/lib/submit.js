/*
 * Shared intake submission. Endpoints are injected at build time via
 * Amplify environment variables (see README); when an endpoint is not
 * configured the forms render an honest preview state instead.
 */
export function postJson(endpoint, payload, { timeoutMs = 10000 } = {}) {
  // PII travels here — refuse non-HTTPS endpoints (localhost allowed for dev)
  if (!/^https:\/\//.test(endpoint) && !/^http:\/\/localhost[:/]/.test(endpoint)) {
    return Promise.reject(new Error('Intake endpoint must be https'))
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .then((res) => {
      if (!res.ok) throw new Error(`Intake endpoint responded ${res.status}`)
      return true
    })
    .finally(() => clearTimeout(timer))
}

/* Same transport rules as postJson, but the caller needs the response body
   (e.g. the Stripe Checkout URL, a session status). GET when payload is
   omitted, POST otherwise. */
export function requestJson(endpoint, payload, { timeoutMs = 10000 } = {}) {
  if (!/^https:\/\//.test(endpoint) && !/^http:\/\/localhost[:/]/.test(endpoint)) {
    return Promise.reject(new Error('Endpoint must be https'))
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(endpoint, {
    method: payload === undefined ? 'GET' : 'POST',
    ...(payload !== undefined && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    signal: controller.signal,
  })
    .then((res) => {
      if (!res.ok) throw new Error(`Endpoint responded ${res.status}`)
      return res.json()
    })
    .finally(() => clearTimeout(timer))
}
