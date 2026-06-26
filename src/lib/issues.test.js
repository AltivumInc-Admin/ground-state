import { describe, expect, it, vi } from 'vitest'

vi.mock('../content/issues.generated.json', () => ({
  default: [
    { slug: 'b-newer', title: 'B', publishedAt: '2026-06-21T00:00:00Z', excerpt: '', seo: {}, body: [] },
    { slug: 'a-older', title: 'A', publishedAt: '2026-06-10T00:00:00Z', excerpt: '', seo: {}, body: [] },
  ],
}))

const { allIssues, getIssueBySlug } = await import('./issues.js')

describe('issues accessor', () => {
  it('exposes all issues', () => {
    expect(allIssues).toHaveLength(2)
  })
  it('finds an issue by slug', () => {
    expect(getIssueBySlug('a-older')?.title).toBe('A')
  })
  it('returns undefined for an unknown slug', () => {
    expect(getIssueBySlug('nope')).toBeUndefined()
  })
})
