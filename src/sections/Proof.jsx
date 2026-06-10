import Reveal from '../components/Reveal.jsx'

const STATS = [
  {
    value: '$4.1B',
    label: 'Venture capital into quantum startups in 2025 — up from $2.0B in 2024.',
    source: 'Crunchbase',
  },
  {
    value: '96%',
    label: 'Share of global quantum funding concentrated in ~45 dense clusters.',
    source: 'The Quantum Insider',
  },
  {
    value: '~$20B',
    label: 'Projected quantum computing market by 2030, from ~$3.5B in 2025.',
    source: 'MarketsandMarkets',
  },
  {
    value: '~30×',
    label: 'Return on the $3,600 annual fee from a single warm intro that lands one $100K check.',
    source: 'The ROI math',
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
    <section id="proof" className="section proof" aria-labelledby="proof-title">
      <span className="ghost-num" aria-hidden="true">
        06
      </span>
      <div className="container">
        <Reveal>
          <p className="kicker">
            <strong>06</strong> The Proof
          </p>
          <h2 id="proof-title" className="section-title">
            Receipts, not vibes.
          </h2>
          <p className="lede">
            Premium founder networks are a proven category. Curated rooms measurably change
            company outcomes. And quantum is the rare market that is both flooded with capital
            and still small enough to convene.
          </p>
        </Reveal>

        <div className="stats">
          {STATS.map((s, i) => (
            <Reveal key={s.value} className="stat" delay={i * 0.07}>
              <p className="stat-value">{s.value}</p>
              <p className="stat-label">
                {s.label}
                <span className="stat-source">{s.source}</span>
              </p>
            </Reveal>
          ))}
        </div>

        <Reveal as="figure" className="proof-quote">
          <blockquote>
            <p>
              “Access to the right network is a growth multiplier… being in the right rooms,
              getting early credibility, and attracting top talent before you even hit
              product-market fit.”
            </p>
          </blockquote>
          <figcaption>Y Combinator — on why curated networks compound</figcaption>
        </Reveal>

        <div className="proof-tables">
          <Reveal>
            <div className="table-wrap">
              <table className="compare-table">
                <caption>What the premium peer-network market charges</caption>
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
                    <th scope="row">The Quantum Collective</th>
                    <td>$3,600 / yr ($300 / mo)</td>
                    <td>Funded quantum founders</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="table-note">
              The most accessible premium founder network on the market — serious enough to be
              high-signal, modest enough that a funded founder expenses it without a second
              thought. And the only one built for quantum.
            </p>
          </Reveal>

          <Reveal>
            <div className="table-wrap">
              <table className="compare-table">
                <caption>The only room with every box checked</caption>
                <thead>
                  <tr>
                    <th scope="col">Attribute</th>
                    <th scope="col">Free communities & consortia</th>
                    <th scope="col">Accelerators</th>
                    <th scope="col">Generalist premium networks</th>
                    <th scope="col">The Quantum Collective</th>
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
          </Reveal>
        </div>
      </div>
    </section>
  )
}
