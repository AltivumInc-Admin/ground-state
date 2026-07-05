import ArrowMarker from './ArrowMarker.jsx'
import { networks, us } from '../../lib/signals.js'

/*
 * fig. 05 — the open corner.
 * Every premium founder network, plotted: annual price against domain focus.
 * The generalists cluster high-price/low-focus; the quantum-specific,
 * founder-priced corner was empty. That corner is the product.
 *
 * Prices come from signals.generated.json (the same rows the comparison
 * table prints), so the plot can never disagree with the table beside it.
 */
const W = 320
const H = 170

const AX = 40 // y-axis x
const AY = 148 // x-axis y
const TOP = 16
const RIGHT = 306

const P_MAX = 20000
const y = (usd) => AY - (usd / P_MAX) * (AY - TOP - 8)

/* Qualitative x: the generalists sit left, spaced by index; GSS sits in the
   quantum-specific corner. */
const gx = (i) => 78 + i * 20
const GSS_X = 258

/* Short display names for plot labels ("EO (Entrepreneurs' Organization)"
   would collide with the plot frame). */
const shortName = (name) => name.split(' (')[0]

/* Label placement per point, cycled by index — Hampton ($8.5K) and EO ($8K)
   sit almost on the same y, so same-side labels overlap; and a left-side
   label at Hampton's height runs into the $10K axis tick. Below-left for
   Hampton, below-right for EO, above-right for the rest keeps every label
   clear of its neighbors AND the axis. */
const LABEL_POS = [
  { anchor: 'end', dx: -2, dy: 14 },
  { anchor: 'start', dx: 7, dy: 12 },
  { anchor: 'start', dx: 7, dy: -6 },
  { anchor: 'start', dx: 7, dy: -6 },
]

export default function PriceSelectivity() {
  return (
    <svg
      className="price-selectivity"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Scatter plot of annual price against domain focus. ${networks
        .map((n) => `${shortName(n.name)} at ${n.price}`)
        .join(', ')} — all generalist. ${us.name} sits alone in the quantum-specific corner at ${us.price}.`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <ArrowMarker id="ps-arrow" />
      </defs>

      {/* Axes (drawn in), arrowheads in the shared plate style */}
      <line
        x1={AX}
        y1={AY}
        x2={AX}
        y2={TOP}
        stroke="var(--fig-stroke)"
        strokeWidth="1.4"
        markerEnd="url(#ps-arrow)"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={AX}
        y1={AY}
        x2={RIGHT}
        y2={AY}
        stroke="var(--fig-stroke)"
        strokeWidth="1.4"
        markerEnd="url(#ps-arrow)"
        vectorEffect="non-scaling-stroke"
      />

      {/* y ticks */}
      {[10000, 20000].map((p) => (
        <g key={p}>
          <line
            x1={AX - 4}
            y1={y(p)}
            x2={AX}
            y2={y(p)}
            stroke="var(--fig-stroke)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <text x={AX - 8} y={y(p) + 3} textAnchor="end" className="pf-sub">
            ${p / 1000}K
          </text>
        </g>
      ))}
      <text x={AX + 8} y={TOP + 6} className="pf-sub">
        $ / yr
      </text>
      <text x={AX + 4} y={AY + 13} className="pf-sub">
        generalist
      </text>
      <text x={RIGHT} y={AY + 13} textAnchor="end" className="pf-sub">
        quantum-specific
      </text>

      {/* The generalists */}
      {networks.map((n, i) => {
        const pos = LABEL_POS[i % LABEL_POS.length]
        return (
          <g key={n.name}>
            <circle cx={gx(i)} cy={y(n.priceUsd)} r="3" fill="var(--fig-stroke)" />
            <text
              x={gx(i) + pos.dx}
              y={y(n.priceUsd) + pos.dy}
              textAnchor={pos.anchor}
              className="pf-sub"
            >
              {shortName(n.name)}
            </text>
          </g>
        )
      })}

      {/* Us — alone in the corner, guides dropped to both axes */}
      <line
        x1={AX}
        y1={y(us.priceUsd)}
        x2={GSS_X}
        y2={y(us.priceUsd)}
        stroke="var(--line-strong)"
        strokeWidth="1"
        strokeDasharray="3 5"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={GSS_X}
        y1={AY}
        x2={GSS_X}
        y2={y(us.priceUsd)}
        stroke="var(--line-strong)"
        strokeWidth="1"
        strokeDasharray="3 5"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={GSS_X} cy={y(us.priceUsd)} r="4.5" fill="var(--accent-display)" />
      {/* Anchored to the plot's right edge, above the point — clear of the
          generalists' labels and of the axis annotations below. */}
      <text x={RIGHT - 6} y={y(us.priceUsd) - 22} textAnchor="end" className="pf-acc">
        {us.name}
      </text>
      <text x={RIGHT - 6} y={y(us.priceUsd) - 10} textAnchor="end" className="pf-num">
        ${(us.priceUsd / 1000).toFixed(1)}K — the open corner
      </text>
    </svg>
  )
}
