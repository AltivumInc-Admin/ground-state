import { Link } from 'react-router-dom'
import Mark from './Mark.jsx'
import Mosaic from './Mosaic.jsx'

export default function Footer() {
  return (
    <footer className="footer ground-dark">
      <Mosaic className="mosaic-corner" cols={12} rows={3} seed={71} />
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">
              <Mark size={34} />
              <div>
                <p className="footer-wordmark">The Ground State Society</p>
                <p className="footer-tag">
                  The private, members-only network for funded quantum founders. Built early, on
                  purpose — to be the default room as the field grows tenfold.
                </p>
              </div>
            </div>
          </div>
          <div>
            <h4 className="label">The Page</h4>
            <ul className="footer-links">
              <li>
                <Link to="/#problem">The Problem</Link>
              </li>
              <li>
                <Link to="/#story">The Story</Link>
              </li>
              <li>
                <Link to="/#proof">The Proof</Link>
              </li>
              <li>
                <Link to="/#inside">Inside the Round</Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="label">Join</h4>
            <ul className="footer-links">
              <li>
                <Link to="/apply">Apply for membership</Link>
              </li>
              <li>
                <Link to="/#signal">The Signal — free</Link>
              </li>
              <li>
                <Link to="/apply">Partner enquiries</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom label">
          <p>© 2026 Altivum Inc. All rights reserved.</p>
          <p>E₀ — membership by application only.</p>
        </div>
      </div>
    </footer>
  )
}
