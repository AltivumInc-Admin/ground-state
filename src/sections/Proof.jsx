import Fx from '../lib/fx.jsx'
import Mosaic from '../components/Mosaic.jsx'
import FigCaption from '../components/figures/FigCaption.jsx'
import FundingTrend from '../components/figures/FundingTrend.jsx'
import Concentration from '../components/figures/Concentration.jsx'
import PriceSelectivity from '../components/figures/PriceSelectivity.jsx'
import { stats, funding, concentration, networks, us, matrix, asOfDisplay } from '../lib/signals.js'

/*
 * Every number in this section flows from src/content/signals.source.json
 * through fetch-signals.mjs (validated + derived at build, staleness-guarded)
 * into lib/signals.js — the stats, the figures, and the tables all read the
 * same generated shape, so they cannot disagree with each other. The plain
 * tables stay as the reduced-motion / no-JS / crawler-legible backstop; the
 * figures are the same claims as geometry.
 */

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
        {/* The freshness IS the credibility — fetch-signals.mjs stamps and
            guards this date at every build. */}
        <p className="proof-asof label" data-fade>
          figures as of {asOfDisplay} · sources cited per claim
        </p>

        <div className="stats" data-stagger>
          {stats.map((s) => (
            <div key={s.label} className="stat">
              <p className="stat-value">
                <span
                  data-count={s.count.n}
                  data-prefix={s.count.prefix}
                  data-suffix={s.count.suffix}
                  data-decimals={s.count.decimals}
                >
                  {s.display}
                </span>
              </p>
              <p className="stat-label">
                {s.label}
                <span className="stat-source label">{s.source}</span>
              </p>
            </div>
          ))}
        </div>

        {/* The same claims, as geometry — the lab-notebook plates continue
            the fig. numbering in reading order (02 Problem → 03-05 here →
            06 Inside → 07 Final CTA). */}
        <div className="proof-figures">
          <figure className="qfig proof-fig" data-fade>
            <div data-draw>
              <FundingTrend />
            </div>
            <FigCaption num="03">
              Capital in, market ahead. VC into quantum went ×{funding.multipleDisplay} in one
              year — against a projected ~${funding.market.toUsdB}B market by{' '}
              {funding.market.toYear}. {funding.vcSource}; {funding.marketSource}.
            </FigCaption>
          </figure>
          <figure className="qfig proof-fig" data-fade>
            <div data-draw>
              <Concentration />
            </div>
            <FigCaption num="04">
              One dot per funding percentage point: {concentration.sharePct} of every 100 land
              inside ~{concentration.clusters} dense clusters. The map is small enough to
              convene. {concentration.source}.
            </FigCaption>
          </figure>
          <figure className="qfig proof-fig" data-fade>
            <div data-draw>
              <PriceSelectivity />
            </div>
            <FigCaption num="05">
              Annual price vs domain focus, every premium founder network. The
              quantum-specific, founder-priced corner was empty — that corner is the product.
            </FigCaption>
          </figure>
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
                  {networks.map((n) => (
                    <tr key={n.name}>
                      <th scope="row">{n.name}</th>
                      <td data-label="Price">{n.price}</td>
                      <td data-label="Bar to enter" className="muted">{n.bar}</td>
                    </tr>
                  ))}
                  <tr className="is-us">
                    <th scope="row">{us.name}</th>
                    <td data-label="Price">{us.price}</td>
                    <td data-label="Bar to enter">{us.bar}</td>
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
                    {matrix.columns.map((col) => (
                      <th key={col} scope="col">
                        {col}
                      </th>
                    ))}
                    <th scope="col">{us.name}</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((row) => (
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
