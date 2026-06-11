import Fx from '../lib/fx.jsx'
import Mosaic from '../components/Mosaic.jsx'

const STATS = [
  {
    value: '$4.1B',
    count: { n: '4.1', prefix: '$', suffix: 'B', decimals: '1' },
    label: 'Venture capital into quantum startups in 2025 — up from $2.0B in 2024.',
    source: 'Crunchbase',
  },
  {
    value: '96%',
    count: { n: '96', prefix: '', suffix: '%', decimals: '0' },
    label: 'Share of global quantum funding concentrated in ~45 dense clusters.',
    source: 'The Quantum Insider',
  },
  {
    value: '~$20B',
    count: { n: '20', prefix: '~$', suffix: 'B', decimals: '0' },
    label: 'Projected quantum computing market by 2030, from ~$3.5B in 2025.',
    source: 'MarketsandMarkets',
  },
  {
    value: '~30×',
    count: { n: '30', prefix: '~', suffix: '×', decimals: '0' },
    label: 'Return on the $3,600 annual fee if a single warm intro lands one $100K check.',
    source: 'The ROI math, illustrated',
  },
]

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

function MatrixCell({ value }) {
  if (value === 'yes')
    return (
      <td>
        <span className="mark-yes" aria-hidden="true">
          ✓
        </span>
        <span className="visually-hidden">Yes</span>
      </td>
    )
  if (value === 'partial')
    return (
      <td>
        <span className="muted">Partial</span>
      </td>
    )
  return (
    <td>
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
            <div key={s.value} className="stat">
              <p className="stat-value">
                <span
                  data-count={s.count.n}
                  data-prefix={s.count.prefix}
                  data-suffix={s.count.suffix}
                  data-decimals={s.count.decimals}
                >
                  {s.value}
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
              <table className="compare-table">
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
                      <td>{n.price}</td>
                      <td className="muted">{n.bar}</td>
                    </tr>
                  ))}
                  <tr className="is-us">
                    <th scope="row">The Ground State Society</th>
                    <td>$3,600 / yr ($300 / mo)</td>
                    <td>Vetted quantum founders</td>
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
            <div className="table-wrap">
              <table className="compare-table">
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
                      <td className="is-us">
                        <span className="mark-yes" aria-hidden="true">
                          ✓
                        </span>
                        <span className="visually-hidden">Yes</span>
                      </td>
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
