import { describe, expect, it } from 'vitest'
import { formatDate } from './formatDate.js'

describe('formatDate', () => {
  it('returns empty string for empty string input', () => {
    expect(formatDate('')).toBe('')
  })

  it('returns empty string for null input', () => {
    expect(formatDate(null)).toBe('')
  })

  it('returns a non-empty string containing the year for a valid ISO date', () => {
    const result = formatDate('2026-06-20T00:00:00Z')
    expect(result).not.toBe('')
    expect(result).toContain('2026')
  })
})
