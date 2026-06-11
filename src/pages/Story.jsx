import { Link } from 'react-router-dom'
import Story from '../sections/Story.jsx'

export default function StoryPage() {
  return (
    <div className="story-page">
      <Story />
      <div className="container story-page-cta">
        <Link to="/apply" className="btn btn-primary">
          Apply for membership
          <span className="btn-arrow" aria-hidden="true">
            →
          </span>
        </Link>
        <Link to="/" className="btn btn-ghost">
          Back to the page
        </Link>
      </div>
    </div>
  )
}
