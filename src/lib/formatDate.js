export function formatDate(iso) {
  if (!iso) return ''
  // Format in UTC: publishedAt is a UTC instant, and without this a
  // midnight-UTC date renders as the previous day for readers behind UTC.
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
