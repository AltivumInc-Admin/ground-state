import issues from '../content/issues.generated.json'

// fetch-issues.mjs already orders by publishedAt desc; this module is a thin,
// testable accessor so components don't import the generated JSON directly.
export const allIssues = issues

export function getIssueBySlug(slug) {
  return allIssues.find((issue) => issue.slug === slug)
}
