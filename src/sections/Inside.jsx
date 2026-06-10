import { Link } from 'react-router-dom'
import Reveal from '../components/Reveal.jsx'

const ROOM = [
  {
    title: 'Curated peer circles',
    body: 'Confidential mastermind circles of 6–10 founders, matched by stage and modality — hardware, software, sensing, networking, post-quantum. Recurring, facilitated, structured.',
  },
  {
    title: 'Vetted member directory',
    body: 'Searchable by company, modality, stage, and cluster. Find the only other founder solving cryogenic control — in minutes.',
  },
  {
    title: 'High-signal private channel',
    body: 'Founders only. No spam, no vendor pitches — norms enforced. The reason members open the app daily.',
  },
  {
    title: 'Members-only events & annual summit',
    body: 'Timed to the conference circuit — IEEE Quantum Week, Q2B, APS March Meeting — so the network convenes where you already travel.',
  },
]

const ACCELERATION = [
  {
    title: 'Curated capital access',
    body: 'Warm introductions to deep-tech and quantum-focused investors, periodic member-only investor days, and shared fundraising intelligence: who is writing checks, timing, terms.',
  },
  {
    title: 'Expert office hours',
    body: 'Recurring sessions with quantum-fluent specialists you can’t easily reach cold: deep-tech VCs, IP and patent attorneys, enterprise and government BD operators, cloud architects.',
  },
  {
    title: 'The Quantum Operator’s Library',
    body: 'Living, member-only playbooks: raising a deep-tech round, structuring SBIR and grant funding, selling quantum pilots to enterprises, hiring scarce quantum talent.',
  },
  {
    title: 'Partner perks & credits',
    body: 'Negotiated cloud credits and legal/IP discounts — hard-dollar value you can point to from day one.',
  },
  {
    title: 'Customer & pilot access',
    body: 'Curated introductions to enterprise and government buyers running quantum pilots — earned as the network matures. We tell you what’s real.',
  },
]

const RECEIPT_INCLUDED = [
  'Curated peer circle (6–10)',
  'Warm capital introductions',
  'Expert office hours',
  'Operator’s Library',
  'Partner cloud credits',
  'Legal & IP discounts',
  'Directory + private channel',
  'Members-only events + summit',
]

export default function Inside() {
  return (
    <section id="inside" className="section" aria-labelledby="inside-title">
      <span className="ghost-num" aria-hidden="true">
        07
      </span>
      <div className="container">
        <Reveal>
          <p className="kicker">
            <strong>07</strong> Inside the Round
          </p>
          <h2 id="inside-title" className="section-title">
            What $300 a month actually buys.
          </h2>
          <p className="lede">
            Two promises, deliberately: <strong>the room</strong> — an elite peer network you
            cannot reach cold — and <strong>the acceleration</strong> — concrete resources that
            move your company forward.
          </p>
        </Reveal>

        <div className="stack-groups">
          <Reveal>
            <h3 className="stack-group-title">A — The Room</h3>
            <ul className="stack-list">
              {ROOM.map((item, i) => (
                <li key={item.title} className="stack-item">
                  <span className="stack-num" aria-hidden="true">
                    0{i + 1}
                  </span>
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.12}>
            <h3 className="stack-group-title">B — The Acceleration</h3>
            <ul className="stack-list">
              {ACCELERATION.map((item, i) => (
                <li key={item.title} className="stack-item">
                  <span className="stack-num" aria-hidden="true">
                    0{i + 5}
                  </span>
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <div className="receipt-row-layout">
          <Reveal className="receipt-intro">
            <h3>The ROI receipt</h3>
            <p>
              Partner credits, legal discounts, and expert sessions carry hard-dollar value
              before a single introduction is made. Quantum founders already spend
              $3,000–$10,000 a year on conferences alone — this is the room those trips are
              trying to find.
            </p>
            <p>
              And the headline math: at $3,600 a year, one warm intro that leads to one $100K
              check returns roughly thirty times the fee.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="receipt" role="img" aria-label="Itemized receipt: every membership deliverable included for $3,600 per year; one $100K introduction returns about 30 times the fee; a year of conference travel costs $3,000 to $10,000 for comparison">
              <span className="receipt-stamp">Application only</span>
              <p className="receipt-head">The Quantum Collective</p>
              <p className="receipt-sub">The Round — annual membership</p>
              <hr className="receipt-rule" />
              <p className="receipt-label">Itemized</p>
              {RECEIPT_INCLUDED.map((item) => (
                <p key={item} className="receipt-line">
                  <span className="item">{item}</span>
                  <span className="dots" />
                  <span className="val">incl.</span>
                </p>
              ))}
              <hr className="receipt-rule" />
              <p className="receipt-line is-total">
                <span className="item">Annual fee (12 × $300)</span>
                <span className="dots" />
                <span className="val">$3,600</span>
              </p>
              <p className="receipt-line is-roi">
                <span className="item">One $100K intro, returned</span>
                <span className="dots" />
                <span className="val">~30×</span>
              </p>
              <hr className="receipt-rule" />
              <p className="receipt-label">For comparison</p>
              <p className="receipt-line">
                <span className="item">A year of conference travel</span>
                <span className="dots" />
                <span className="val">$3–10K</span>
              </p>
              <p className="receipt-foot">Expensable · Billed monthly · Vetted founders only</p>
            </div>
          </Reveal>
        </div>

        <Reveal>
          <h3 className="stack-group-title" style={{ borderBottom: 'none', marginBottom: 0 }}>
            The Tiers
          </h3>
        </Reveal>
        <div className="tiers">
          <Reveal className="tier" as="article" aria-label="The Signal tier">
            <div className="tier-head">
              <h3 className="tier-name">The Signal</h3>
              <p className="tier-aud">Every quantum builder</p>
            </div>
            <p className="tier-price">
              Free<small>forever</small>
            </p>
            <div className="tier-body">
              <ul>
                <li>The newsletter — funding moves & ecosystem intel</li>
                <li>Public webinars</li>
                <li>Open community channel</li>
                <li>Ecosystem content & member spotlights</li>
              </ul>
            </div>
            <div className="tier-foot">
              <Link to="/#signal" className="btn btn-ghost">
                Join free
              </Link>
              <p className="tier-note">The outer ring — open to founders, engineers, researchers, students.</p>
            </div>
          </Reveal>

          <Reveal className="tier is-featured" as="article" delay={0.1} aria-label="The Round tier">
            <div className="tier-head">
              <span className="tier-flag">The Product</span>
              <h3 className="tier-name">The Round</h3>
              <p className="tier-aud">Funded quantum founders</p>
            </div>
            <p className="tier-price">
              $300<small>/ month</small>
            </p>
            <div className="tier-body">
              <ul>
                <li>Curated, confidential peer circle of 6–10</li>
                <li>Warm intros to quantum-focused capital</li>
                <li>Expert office hours, monthly</li>
                <li>Vetted directory + high-signal private channel</li>
                <li>Members-only events + annual summit</li>
                <li>Operator’s Library + partner perks & credits</li>
              </ul>
            </div>
            <div className="tier-foot">
              <Link to="/apply" className="btn btn-primary">
                Apply for membership
              </Link>
              <p className="tier-note">Founding cohort: locked-in rate, permanent founding badge.</p>
            </div>
          </Reveal>

          <Reveal className="tier" as="article" delay={0.2} aria-label="Patrons and Partners tier">
            <div className="tier-head">
              <h3 className="tier-name">Patrons & Partners</h3>
              <p className="tier-aud">Sponsors & allies</p>
            </div>
            <p className="tier-price">
              Invitation<small>only</small>
            </p>
            <div className="tier-body">
              <ul>
                <li>For cloud platforms, deep-tech VCs, IP firms</li>
                <li>Credible access & brand association</li>
                <li>Sponsored programming</li>
                <li>Never seats in the core peer circles</li>
              </ul>
            </div>
            <div className="tier-foot">
              <Link to="/apply" className="btn btn-ghost">
                Enquire
              </Link>
              <p className="tier-note">Sponsorship subsidizes member value — it never dilutes the room.</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
