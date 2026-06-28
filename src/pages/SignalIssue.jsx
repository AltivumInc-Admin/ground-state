import { Link, Navigate, useParams } from 'react-router-dom'
import { getIssueBySlug } from '../lib/issues.js'
import IssueBody from '../components/IssueBody.jsx'
import SignalSubscribe from '../components/SignalSubscribe.jsx'
import usePageMeta from '../lib/usePageMeta.js'
import { formatDate } from '../lib/formatDate.js'

export default function SignalIssue() {
  const { slug } = useParams()
  const issue = getIssueBySlug(slug)

  // Hooks must run unconditionally; compute meta from the issue (or fall back).
  usePageMeta({
    title: issue ? issue.seo?.title || issue.title : 'The Signal',
    description: issue ? issue.seo?.description || issue.excerpt : undefined,
    noindex: issue?.seo?.noIndex === true,
  })

  // Tell the archive why the reader landed there, so a stale/shared issue
  // link gets a "not found" notice instead of a silent bounce.
  if (!issue) return <Navigate to="/signal" replace state={{ notFound: slug }} />

  return (
    <article className="signal-issue container">
      <header className="signal-issue-head">
        <p className="signal-issue-kicker">
          <Link to="/signal">The Signal</Link>
        </p>
        <h1>{issue.title}</h1>
        <time dateTime={issue.publishedAt ?? undefined}>{formatDate(issue.publishedAt)}</time>
      </header>
      <IssueBody value={issue.body} />
      <SignalSubscribe
        kicker="Keep getting The Signal"
        heading="The next issue, in your inbox."
        blurb="Free — funding moves, ecosystem intel, and hard-won lessons for quantum builders."
      />
      <footer className="signal-issue-foot">
        <Link to="/signal" className="btn btn-ghost">
          All issues
        </Link>
      </footer>
    </article>
  )
}
