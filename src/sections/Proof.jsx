import Fx from '../lib/fx.jsx'
import Mosaic from '../components/Mosaic.jsx'

// The static fallback display value is `${prefix}${n}${suffix}` — derived from
// the count parts so there's one source of truth (no separate `value` to drift).
const STATS = [
  {
    count: { n: '4.1', prefix: '$', suffix: 'B', decimals: '1' },
    label: 'Venture capital into quantum startups in 2025 — up from $2.0B in 2024.',
    source: 'Crunchbase',
  },
  {
    count: { n: '96', prefix: '', suffix: '%', decimals: '0' },
    label: 'Share of global quantum funding concentrated in ~45 dense clusters.',
    source: 'The Quantum Insider',
  },
  {
    count: { n: '20', prefix: '~$', suffix: 'B', decimals: '0' },
    label: 'Projected quantum computing market by 2030, from ~$3.5B in 2025.',
    source: 'MarketsandMarkets',
  },
  {
    count: { n: '30', prefix: '~', suffix: '×', decimals: '0' },
    label: 'Return on the $3,600 annual fee if a single warm intro lands one $100K check.',
    source: 'The ROI math, illustrated',
  },
]

// Display value for a stat's static fallback (before the counter animates).
const statValue = (c) => `${c.prefix}${c.n}${c.suffix}`

const NETWORKS = [
  { name: 'Hampton', price: '~$8,500 / yr', bar: '$3M+ revenue or funding, tech focus' },
  { name: 'EO (Entrepreneurs’ Organization)', price: '$6,000–$10,000 / yr', bar: '$1M+ revenue' },
  { name: 'YPO', price: '$10,000+ / yr', bar: 'Large-company CEOs' },
  { name: 'Vistage', price: '$10,000–$20,000 / yr', bar: 'Executives' },
]

const MATRIX = [
  { attr: 'Quantum-specific domain', cells: ['yes', 'yes', 'no'] },
  { attr: 'Founders-only peer group', cells: ['no', 'partial', 'yes'] },
  { attr: 'Ongoing — not time-limited', cells: ['yes', 'no', 'yes'] },
  { attr: 'Curated / selective', cells: ['no', 'yes', 'yes'] },
  { attr: 'Confidential', cells: ['no', 'partial', 'yes'] },
  { attr: 'Structured peer accountability', cells: ['no', 'no', 'yes'] },
  { attr: 'Warm capital introductions', cells: ['no', 'partial', 'partial'] },
]

function MatrixCell({ value, className }) {
  if (value === 'yes')
    return (
      <td className={className}>
        <span className="mark-yes" aria-hidden="true">
          ✓
        </span>
        <span className="visually-hidden">Yes</span>
      </td>
    )
  if (value === 'partial')
    return (
      <td className={className}>
        <span className="muted">Partial</span>
      </td>
    )
  return (
    <td className={className}>
      <span className="mark-no" aria-hidden="true">
        —
      </span>
      <span className="visually-hidden">No</span>
    </td>
  )
}

export default function Proof() {
  return (
    <Fx as="section" id="proof" className="section proof ground-dark" aria-labelledby="proof-title">
      <Mosaic className="mosaic-corner" cols={10} rows={5} seed={29} />
      <div className="container">
        <p className="kicker" data-fade>
          <strong>03</strong> The Proof
        </p>
        <h2 id="proof-title" className="section-title" data-split>
          Receipts, not vibes.
        </h2>
        <p className="lede" data-fade>
          Premium founder networks are a proven category. Curated rooms measurably change
          company outcomes. And quantum is the rare market that is both flooded with capital
          and still small enough to convene.
        </p>

        <div className="stats" data-stagger>
          {STATS.map((s) => (
            <div key={s.label} className="stat">
              <p className="stat-value">
                <span
                  data-count={s.count.n}
                  data-prefix={s.count.prefix}
                  data-suffix={s.count.suffix}
                  data-decimals={s.count.decimals}
                >
                  {statValue(s.count)}
                </span>
              </p>
              <p className="stat-label">
                {s.label}
                <span className="stat-source label">{s.source}</span>
              </p>
            </div>
          ))}
        </div>

        <figure className="proof-quote" data-fade>
          <blockquote>
            <p>
              “Access to the right network is a growth multiplier… being in the right rooms,
              getting early credibility, and attracting top talent before you even hit
              product-market fit.”
            </p>
          </blockquote>
          <figcaption className="label">Y Combinator — on why curated networks compound</figcaption>
        </figure>

        <div className="proof-tables">
          <div data-fade>
            <div className="table-wrap">
              {/* is-stack: reflows into stacked rows on small screens —
                  three prose columns need no horizontal scroll */}
              <table className="compare-table is-stack">
                <caption className="label">What the premium peer-network market charges</caption>
                <thead>
                  <tr>
                    <th scope="col">Network</th>
                    <th scope="col">Price</th>
                    <th scope="col">Bar to enter</th>
                  </tr>
                </thead>
                <tbody>
                  {NETWORKS.map((n) => (
                    <tr key={n.name}>
                      <th scope="row">{n.name}</th>
                      <td data-label="Price">{n.price}</td>
                      <td data-label="Bar to enter" className="muted">{n.bar}</td>
                    </tr>
                  ))}
                  <tr className="is-us">
                    <th scope="row">The Ground State Society</th>
                    <td data-label="Price">$3,600 / yr ($300 / mo)</td>
                    <td data-label="Bar to enter">Vetted quantum founders</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="table-note">
              The most accessible premium founder network on the market — serious enough to be
              high-signal, modest enough that a founder expenses it without a second
              thought. And the only one built for quantum.
            </p>
          </div>

          <div data-fade>
            {/* The matrix keeps its grid on mobile: first column pins,
                edge glow marks hidden columns, and the cue says so */}
            <p className="scroll-cue label" aria-hidden="true">
              scroll →
            </p>
            <div className="table-wrap">
              <table className="compare-table is-matrix">
                <caption className="label">The only room with every box checked</caption>
                <thead>
                  <tr>
                    <th scope="col">Attribute</th>
                    <th scope="col">Free communities & consortia</th>
                    <th scope="col">Accelerators</th>
                    <th scope="col">Generalist premium networks</th>
                    <th scope="col">The Ground State Society</th>
                  </tr>
                </thead>
                <tbody>
                  {MATRIX.map((row) => (
                    <tr key={row.attr}>
                      <th scope="row">{row.attr}</th>
                      {row.cells.map((cell, i) => (
                        <MatrixCell key={i} value={cell} />
                      ))}
                      <MatrixCell value="yes" className="is-us" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="table-note">
              Every alternative has at least one structural gap. Payment creates skin in the
              game, curation creates the signal, and confidentiality makes the real
              conversations possible.
            </p>
          </div>
        </div>
      </div>
    </Fx>
  )
}
