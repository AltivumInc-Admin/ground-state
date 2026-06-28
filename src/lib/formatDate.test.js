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

  it('formats a midnight-UTC date in UTC (no timezone off-by-one)', () => {
    // Regression: without timeZone:'UTC' this renders "June 23, 2026"
    // for any runner behind UTC. Must be deterministic regardless of TZ.
    expect(formatDate('2026-06-24T00:00:00Z')).toBe('June 24, 2026')
  })

  it('returns empty string (not "Invalid Date") for an unparseable string', () => {
    expect(formatDate('not-a-date')).toBe('')
    expect(formatDate('2026-13-99T00:00:00Z')).toBe('')
  })
})
