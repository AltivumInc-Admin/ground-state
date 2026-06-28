import { Link } from 'react-router-dom'
import Fx from '../lib/fx.jsx'
import EnergyLevels from '../components/figures/EnergyLevels.jsx'
import FigCaption from '../components/figures/FigCaption.jsx'

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

const TIERS = [
  {
    name: 'The Signal',
    aud: 'Every quantum builder',
    price: 'Free',
    per: 'forever',
    items: [
      'The newsletter — funding moves & ecosystem intel',
      'Public webinars',
      'Open community channel',
      'Ecosystem content & member spotlights',
    ],
    cta: { to: '/#signal', label: 'Join free', variant: 'btn-ghost' },
    note: 'The outer ring — open to founders, engineers, researchers, students.',
    ariaLabel: 'The Signal tier',
  },
  {
    name: 'The Round',
    aud: 'Operating quantum founders',
    price: '$300',
    per: '/ month',
    featured: true,
    flag: 'The Product',
    items: [
      'Curated, confidential peer circle of 6–10',
      'Warm intros to quantum-focused capital',
      'Expert office hours, monthly',
      'Vetted directory + high-signal private channel',
      'Members-only events + annual summit',
      'Operator’s Library + partner perks & credits',
    ],
    cta: { to: '/apply', label: 'Apply for membership', variant: 'btn-primary' },
    note: 'Founding cohort: locked-in rate, permanent founding badge.',
    ariaLabel: 'The Round tier',
  },
  {
    name: 'Patrons & Partners',
    aud: 'Sponsors & allies',
    price: 'Invitation',
    per: 'only',
    items: [
      'For cloud platforms, deep-tech VCs, IP firms',
      'Credible access & brand association',
      'Sponsored programming',
      'Never seats in the core peer circles',
    ],
    cta: { to: '/apply', label: 'Enquire', variant: 'btn-ghost' },
    note: 'Sponsorship subsidizes member value — it never dilutes the room.',
    ariaLabel: 'Patrons and Partners tier',
  },
]

// One group of the "what you get" stack. data-fade on the heading (not a
// wrapper around the list) so its entrance never compounds with the list's
// own data-stagger y-offset. startNum continues the numbering across groups.
function StackGroup({ letter, title, items, startNum }) {
  return (
    <div>
      <h3 className="stack-group-title" data-fade>
        <span className="label" aria-hidden="true">
          {letter}
        </span>{' '}
        {title}
      </h3>
      <ul className="stack-list" data-stagger>
        {items.map((item, i) => (
          <li key={item.title} className="stack-item">
            <span className="stack-num label" aria-hidden="true">
              {String(startNum + i).padStart(2, '0')}
            </span>
            <div>
              <h4>{item.title}</h4>
              <p>{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Inside() {
  return (
    <Fx as="section" id="inside" className="section" aria-labelledby="inside-title">
      <div className="container">
        <p className="kicker" data-fade>
          <strong>04</strong> Inside the Round
        </p>
        <h2 id="inside-title" className="section-title" data-split>
          What $300 a month actually buys.
        </h2>
        <p className="lede" data-fade>
          Two promises, deliberately: <strong>the room</strong> — an elite peer network you
          cannot reach cold — and <strong>the acceleration</strong> — concrete resources that
          move your company forward.
        </p>

        <div className="stack-groups">
          <StackGroup letter="A" title="The Room" items={ROOM} startNum={1} />
          <StackGroup
            letter="B"
            title="The Acceleration"
            items={ACCELERATION}
            startNum={ROOM.length + 1}
          />
        </div>

        <div className="receipt-row-layout">
          <div className="receipt-intro" data-fade>
            <h3>The ROI receipt</h3>
            <p>
              Partner credits, legal discounts, and expert sessions carry hard-dollar value
              before a single introduction is made. Quantum founders already spend
              $3,000–$10,000 a year on conferences alone — this is the room those trips are
              trying to find.
            </p>
            <p>
              And the asymmetry: at $3,600 a year, a single warm intro that leads to a $100K
              check would return roughly thirty times the fee. We don’t promise that outcome —
              we build the room where it happens.
            </p>
          </div>
          <div data-fade>
            {/* Real text, read naturally by AT — no role=img summary needed */}
            <div className="receipt ground-dark" data-tilt>
              <span className="receipt-stamp label">Application only</span>
              <p className="receipt-head">The Ground State Society</p>
              <p className="receipt-sub label">The Round — annual membership</p>
              <hr className="receipt-rule" />
              <p className="receipt-label label">Itemized</p>
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
                <span className="item">If one intro lands $100K</span>
                <span className="dots" />
                <span className="val">~30×</span>
              </p>
              <p className="receipt-line is-roi">
                <span className="item">Refer a founder who joins</span>
                <span className="dots" />
                <span className="val">1 mo free</span>
              </p>
              <hr className="receipt-rule" />
              <p className="receipt-label label">For comparison</p>
              <p className="receipt-line">
                <span className="item">A year of conference travel</span>
                <span className="dots" />
                <span className="val">$3–10K</span>
              </p>
              <p className="receipt-foot label">Expensable · Billed monthly · Vetted founders only</p>
            </div>
          </div>
        </div>

        <div className="tiers-head">
          <div data-fade>
            <h3 className="stack-group-title is-bare">The Tiers</h3>
            <p className="tiers-lede">
              Membership is quantized: three discrete states, no continuum between them.
            </p>
          </div>
          <figure className="qfig ground-dark" data-fade>
            <div data-draw>
              <EnergyLevels />
            </div>
            <FigCaption num="03">
              Discrete levels, E<sub>n</sub> ∝ n². The only transition up from the ground state
              is an application.
            </FigCaption>
          </figure>
        </div>
        <div className="tiers" data-stagger>
          {TIERS.map((t) => (
            <article
              key={t.name}
              className={`tier${t.featured ? ' is-featured ground-dark' : ''}`}
              aria-label={t.ariaLabel}
            >
              <div className="tier-head">
                {t.flag ? <span className="tier-flag label">{t.flag}</span> : null}
                <h3 className="tier-name">{t.name}</h3>
                <p className="tier-aud label">{t.aud}</p>
              </div>
              <p className="tier-price">
                {t.price}
                <small>{t.per}</small>
              </p>
              <div className="tier-body">
                <ul>
                  {t.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="tier-foot">
                <Link to={t.cta.to} className={`btn ${t.cta.variant}`}>
                  {t.cta.label}
                </Link>
                <p className="tier-note">{t.note}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Fx>
  )
}
