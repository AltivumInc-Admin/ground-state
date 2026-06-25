// Vitest setup — jest-dom matchers + jsdom polyfills for browser APIs the app
// touches (matchMedia via GSAP's matchMedia gate, and the observers used by the
// scenes). jsdom implements none of these by default.
import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

if (!window.matchMedia) {
  // matches:false => '(prefers-reduced-motion: no-preference)' is false, so GSAP's
  // motion-gated tweens never register — components render in their static state.
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: () => false,
  })
}

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
globalThis.IntersectionObserver ??= NoopObserver
globalThis.ResizeObserver ??= NoopObserver
