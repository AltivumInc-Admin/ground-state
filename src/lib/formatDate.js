export function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  // A present-but-malformed value (e.g. a bad CMS string) parses to an
  // invalid Date; return '' rather than rendering the literal "Invalid Date".
  if (Number.isNaN(d.getTime())) return ''
  // Format in UTC: publishedAt is a UTC instant, and without this a
  // midnight-UTC date renders as the previous day for readers behind UTC.
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
