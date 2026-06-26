import { Link } from 'react-router-dom'
import { allIssues } from '../lib/issues.js'
import usePageMeta from '../lib/usePageMeta.js'

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function Signal() {
  usePageMeta({
    title: 'The Signal',
    description:
      'The Signal — funding moves, ecosystem intel, and hard-won lessons for the people building the quantum economy. Free to read.',
  })

  return (
    <div className="signal-archive container">
      <header className="signal-archive-head">
        <h1>The Signal</h1>
        <p>Funding moves, ecosystem intel, and hard-won lessons for quantum builders.</p>
      </header>
      {allIssues.length > 0 ? (
        <ul className="signal-archive-list">
          {allIssues.map((issue) => (
            <li key={issue.slug} className="signal-archive-item">
              <Link to={`/signal/${issue.slug}`}>
                <time dateTime={issue.publishedAt ?? undefined}>{formatDate(issue.publishedAt)}</time>
                <h2>{issue.title}</h2>
                {issue.excerpt ? <p>{issue.excerpt}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="signal-archive-empty">The first issue is on its way. Sign up to get it in your inbox.</p>
      )}
    </div>
  )
}
