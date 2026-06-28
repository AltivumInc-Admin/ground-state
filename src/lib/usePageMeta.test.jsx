import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import usePageMeta, {
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_DESCRIPTION,
  ROBOTS_INDEX,
} from './usePageMeta.js'

function Page({ title, description }) {
  usePageMeta({ title, description })
  return null
}

const content = (selector) => document.head.querySelector(selector)?.getAttribute('content')

beforeEach(() => {
  // Mirror the head index.html ships — the hook only mutates tags that exist.
  document.head.innerHTML = `
    <meta name="description" content="SERP description" />
    <meta property="og:title" content="seed" />
    <meta name="twitter:title" content="seed" />
    <meta property="og:description" content="seed" />
    <meta name="twitter:description" content="seed" />
    <meta property="og:url" content="seed" />
    <link rel="canonical" href="seed" />
  `
})

afterEach(cleanup)

describe('usePageMeta — social head reset across SPA navigation', () => {
  it('writes the subpage OG/Twitter title and description', () => {
    render(
      <MemoryRouter initialEntries={['/apply']}>
        <Page title="Apply to join The Round" description="Apply description." />
      </MemoryRouter>,
    )
    const full = 'Apply to join The Round — The Ground State Society'
    expect(content('meta[property="og:title"]')).toBe(full)
    expect(content('meta[name="twitter:title"]')).toBe(full)
    expect(content('meta[property="og:description"]')).toBe('Apply description.')
    expect(content('meta[name="twitter:description"]')).toBe('Apply description.')
  })

  it('resets OG/Twitter to the homepage defaults (not the SERP description) on return home', () => {
    render(
      <MemoryRouter initialEntries={['/apply']}>
        <Page title="Apply to join The Round" description="Apply description." />
      </MemoryRouter>,
    )
    cleanup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <Page />
      </MemoryRouter>,
    )
    expect(content('meta[property="og:title"]')).toBe(
      'The Ground State Society — The Private Network for Quantum Founders',
    )
    const ogDesc = content('meta[property="og:description"]')
    // The hand-tuned homepage OG copy — NOT the plain SERP meta description.
    expect(ogDesc).toMatch(/^The room where the people building the quantum economy/)
    expect(ogDesc).not.toMatch(/free Signal tier/)
  })
})

describe('usePageMeta — homepage defaults stay in sync with index.html (drift guard)', () => {
  // The hook's DEFAULT_* constants intentionally duplicate index.html's static head
  // (a snapshot at module load would capture whichever route loaded first, not the
  // homepage). This guards against the two silently diverging.
  // process.cwd() is the project root under `vitest run`; import.meta.url is not a
  // file:// URL in the jsdom environment, so resolve from cwd instead.
  const html = readFileSync(`${process.cwd()}/index.html`, 'utf8')
  const attr = (re) => html.match(re)?.[1]

  it('DEFAULT_TITLE matches index.html <title>, og:title and twitter:title', () => {
    expect(attr(/<title>([^<]*)<\/title>/)).toBe(DEFAULT_TITLE)
    expect(attr(/<meta property="og:title" content="([^"]*)"/)).toBe(DEFAULT_TITLE)
    expect(attr(/<meta name="twitter:title" content="([^"]*)"/)).toBe(DEFAULT_TITLE)
  })

  it('DEFAULT_DESCRIPTION matches index.html meta description', () => {
    expect(attr(/<meta name="description" content="([^"]*)"/)).toBe(DEFAULT_DESCRIPTION)
  })

  it('DEFAULT_OG_DESCRIPTION matches index.html og:description and twitter:description', () => {
    expect(attr(/<meta property="og:description" content="([^"]*)"/)).toBe(DEFAULT_OG_DESCRIPTION)
    expect(attr(/<meta name="twitter:description" content="([^"]*)"/)).toBe(DEFAULT_OG_DESCRIPTION)
  })

  it('ROBOTS_INDEX matches index.html robots meta', () => {
    expect(attr(/<meta name="robots" content="([^"]*)"/)).toBe(ROBOTS_INDEX)
  })
})
