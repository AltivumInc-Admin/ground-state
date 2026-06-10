import { Link } from 'react-router-dom'
import Mark from './Mark.jsx'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">
              <Mark size={30} onDark />
              <div>
                <p className="footer-wordmark">The Quantum Collective</p>
                <p className="footer-tag">
                  The private, members-only network for funded quantum founders. Built early, on
                  purpose — to be the default room as the field grows tenfold.
                </p>
              </div>
            </div>
          </div>
          <div>
            <h4>The Page</h4>
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
            <h4>Join</h4>
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
        <div className="footer-bottom">
          <p>© 2026 Altivum Inc. All rights reserved.</p>
          <p>Membership by application only.</p>
        </div>
      </div>
    </footer>
  )
}
