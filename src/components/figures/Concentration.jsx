import { concentration } from '../../lib/signals.js'

/*
 * fig. 04 — the concentration.
 * One dot per percentage point of global quantum funding: sharePct dots
 * packed inside the drawn cluster boundary, the remainder scattered outside.
 * The point the geometry makes: the map is small — a room this dense can
 * actually be convened.
 *
 * Deterministic jitter (mulberry32, fixed seed) so the server render and the
 * client hydration compose the identical figure. Under the parent
 * [data-draw] scrub the boundary draws first, then the dots materialize
 * one by one (fx.jsx buckets stroked vs fill-only shapes).
 */
const W = 320
const H = 170

// Cluster boundary
const BX = 26
const BY = 34
const BW = 168
const BH = 108

const { sharePct, clusters, source } = concentration

/* Same deterministic RNG as the hero cloud (GroundStateScene.jsx). */
function mulberry32(seed) {
  let t = seed
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(45)

/* sharePct dots on a jittered grid inside the boundary */
const COLS = 12
const ROWS = Math.ceil(sharePct / COLS)
const PAD = 13
const INSIDE = Array.from({ length: sharePct }, (_, i) => {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  return {
    x: BX + PAD + (col / (COLS - 1)) * (BW - 2 * PAD) + (rand() - 0.5) * 6,
    y: BY + PAD + (row / (ROWS - 1)) * (BH - 2 * PAD) + (rand() - 0.5) * 6,
  }
})

/* The remainder, scattered thin on the open right */
const OUTSIDE_SPOTS = [
  { x: 232, y: 58 },
  { x: 286, y: 84 },
  { x: 248, y: 112 },
  { x: 270, y: 138 },
  { x: 300, y: 48 },
  { x: 226, y: 148 },
]
const OUTSIDE = OUTSIDE_SPOTS.slice(0, Math.max(0, 100 - sharePct))

export default function Concentration() {
  return (
    <svg
      className="concentration"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Diagram: of every 100 dollars of global quantum funding, ${sharePct} land inside roughly ${clusters} dense clusters, drawn as a tightly packed field of dots inside a boundary; the remaining ${100 - sharePct} sit scattered outside. Source: ${source}.`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Cluster boundary — dashed, drawn in (open path, plate language) */}
      <path
        d={`M ${BX} ${BY} L ${BX + BW} ${BY} L ${BX + BW} ${BY + BH} L ${BX} ${BY + BH} Z`}
        fill="none"
        stroke="var(--fig-stroke)"
        strokeWidth="1.4"
        strokeDasharray="3 5"
        vectorEffect="non-scaling-stroke"
      />

      <text x={BX} y={BY - 14} className="pf-label">
        {sharePct}% of global quantum funding
      </text>
      <text x={BX} y={BY + BH + 16} className="pf-sub">
        ~{clusters} dense clusters
      </text>

      {INSIDE.map((d, i) => (
        <circle key={i} cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r="2" fill="var(--fig-stroke)" />
      ))}
      {OUTSIDE.map((d, i) => (
        <circle key={`o-${i}`} cx={d.x} cy={d.y} r="2" fill="var(--ink-mute)" />
      ))}

      <text x={W - 4} y={BY + BH + 16} textAnchor="end" className="pf-sub">
        everywhere else — {100 - sharePct}%
      </text>
    </svg>
  )
}
