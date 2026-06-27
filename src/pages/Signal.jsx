import { Link } from 'react-router-dom'
import { allIssues } from '../lib/issues.js'
import usePageMeta from '../lib/usePageMeta.js'
import { formatDate } from '../lib/formatDate.js'
import SignalSubscribe from '../components/SignalSubscribe.jsx'

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
        <p className="signal-archive-empty">
          The first issue is on its way — subscribe below and it lands in your inbox the moment it ships.
        </p>
      )}
      <SignalSubscribe
        kicker="Free · straight to your inbox"
        heading="Subscribe to The Signal."
        blurb="Funding moves, ecosystem intel, and hard-won lessons for quantum builders — free, no application needed."
      />
    </div>
  )
}
