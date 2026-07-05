import { Link } from 'react-router-dom'
import Story from '../sections/Story.jsx'
import usePageMeta from '../lib/usePageMeta.js'
import { useVtNavigate } from '../lib/vt.js'

export default function StoryPage() {
  usePageMeta({
    title: 'The Story',
    description:
      'Why The Ground State Society exists — the room being built for the people building the quantum economy.',
  })
  const vtNavigate = useVtNavigate()
  return (
    <div className="story-page">
      <Story />
      <div className="container story-page-cta">
        <Link
          to="/apply"
          className="btn btn-primary"
          onClick={(e) => vtNavigate(e, '/apply', 'apply-cta')}
        >
          Apply for membership
          <span className="btn-arrow" aria-hidden="true">
            →
          </span>
        </Link>
        <Link to="/" className="btn btn-ghost" onClick={(e) => vtNavigate(e, '/')}>
          Go to the home page
        </Link>
      </div>
    </div>
  )
}
