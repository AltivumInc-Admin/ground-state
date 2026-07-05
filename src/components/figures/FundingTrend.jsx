import { funding } from '../../lib/signals.js'

/*
 * fig. 03 — capital in, market ahead.
 * VC into quantum by year (outlined columns, actuals) against the projected
 * market curve (dashed, an exponential through the two cited endpoints —
 * rendering of a stated projection, not invented data). One shared $B scale:
 * the record capital influx is still small against the market it is buying
 * into — early, on purpose.
 *
 * Data + derivations come from signals.generated.json via lib/signals.js;
 * nothing numeric is authored here. Strokes draw in under the parent
 * [data-draw] scrub (fx.jsx); fill-only shapes materialize after.
 */
const W = 320
const H = 170
const BASE = 140 // baseline y
const TOP = 22 // y of the scale's max
const X0 = 44 // plot left
const X1 = 294 // plot right

const { vc, market, multipleDisplay, vcSource, marketSource } = funding

const yearMin = vc[0].year
const yearMax = market.toYear
const vMax = Math.max(market.toUsdB, ...vc.map((p) => p.usdB))

const x = (year) => X0 + ((year - yearMin) / (yearMax - yearMin)) * (X1 - X0)
const y = (usdB) => BASE - (usdB / vMax) * (BASE - TOP)

/* Open-bottom column outline — drawable by drawSVG, pure line art. */
function columnPath(cx, v, w = 22) {
  const l = (cx - w / 2).toFixed(1)
  const r = (cx + w / 2).toFixed(1)
  const t = y(v).toFixed(1)
  return `M ${l} ${BASE} L ${l} ${t} L ${r} ${t} L ${r} ${BASE}`
}

/* The projection: v(t) through (fromYear, fromUsdB) → (toYear, toUsdB),
   exponential (constant growth rate), sampled fine enough to read smooth. */
function projectionPath() {
  const { fromYear, fromUsdB, toYear, toUsdB } = market
  const steps = 48
  const pts = []
  for (let i = 0; i <= steps; i++) {
    const t = fromYear + ((toYear - fromYear) * i) / steps
    const v = fromUsdB * Math.pow(toUsdB / fromUsdB, (t - fromYear) / (toYear - fromYear))
    pts.push(`${x(t).toFixed(1)} ${y(v).toFixed(1)}`)
  }
  return `M ${pts.join(' L ')}`
}

const last = vc[vc.length - 1]

export default function FundingTrend() {
  return (
    <svg
      className="funding-trend"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Chart: venture capital into quantum startups rose from $${vc[0].usdB} billion in ${vc[0].year} to $${last.usdB} billion in ${last.year} — ${multipleDisplay} times in one year — while the projected market reaches about $${market.toUsdB} billion by ${market.toYear}. Sources: ${vcSource}; ${marketSource}.`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Plate stroke language (shared with figs 02/04-07): guide 1 dashed
          '3 5', line 1.4, emphasis 1.75, non-scaling weights. */}
      <line
        x1={X0 - 12}
        y1={BASE}
        x2={X1 + 10}
        y2={BASE}
        stroke="var(--fig-stroke)"
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
      />
      {/* the projected ceiling, as a guide */}
      <line
        x1={X0 - 12}
        y1={y(market.toUsdB)}
        x2={X1 + 10}
        y2={y(market.toUsdB)}
        stroke="var(--line-strong)"
        strokeWidth="1"
        strokeDasharray="3 5"
        vectorEffect="non-scaling-stroke"
      />

      {/* VC actuals — outlined columns */}
      {vc.map((p, i) => (
        <path
          key={p.year}
          d={columnPath(x(p.year), p.usdB)}
          fill="none"
          stroke={i === vc.length - 1 ? 'var(--accent-display)' : 'var(--fig-stroke)'}
          strokeWidth={i === vc.length - 1 ? 1.75 : 1.4}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {vc.map((p) => (
        <g key={`t-${p.year}`}>
          <text x={x(p.year)} y={y(p.usdB) - 6} textAnchor="middle" className="pf-num">
            ${p.usdB.toFixed(1)}B
          </text>
          <text x={x(p.year)} y={BASE + 13} textAnchor="middle" className="pf-sub">
            {p.year}
          </text>
        </g>
      ))}
      {/* Below the projection curve's take-off, clear of both the column
          value label above and the baseline year row */}
      <text x={x(last.year) + 14} y={y(last.usdB) + 15} className="pf-acc">
        ×{multipleDisplay} in one year
      </text>

      {/* Market projection — dashed curve to the cited endpoint */}
      <path
        d={projectionPath()}
        fill="none"
        stroke="var(--fig-stroke)"
        strokeWidth="1.4"
        strokeDasharray="3 5"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={x(market.toYear)} cy={y(market.toUsdB)} r="3.2" fill="var(--accent-display)" />
      <text
        x={x(market.toYear) - 8}
        y={y(market.toUsdB) + 14}
        textAnchor="end"
        className="pf-label"
      >
        ~${market.toUsdB}B projected market
      </text>
      <text
        x={x(market.toYear) - 8}
        y={y(market.toUsdB) + 26}
        textAnchor="end"
        className="pf-sub"
      >
        {market.toYear} · dashed = projection
      </text>
      <text x={x(market.toYear)} y={BASE + 13} textAnchor="middle" className="pf-sub">
        {market.toYear}
      </text>
    </svg>
  )
}
