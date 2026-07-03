import ArrowMarker from './ArrowMarker.jsx'

/*
 * fig. 03 — quantized membership.
 * Particle-in-a-box energy levels (E_n ∝ n²) mapped to the three tiers.
 * The only transition up from the ground state is an application: hν = ΔE.
 */
const LEVELS = [
  { n: 1, y: 128, label: 'The Signal', sub: 'ground state · free' },
  { n: 2, y: 88, label: 'The Round', sub: '$300 / mo' },
  { n: 3, y: 22, label: 'Patrons & Partners', sub: 'invitation' },
]

export default function EnergyLevels() {
  return (
    <svg
      className="energy-levels"
      viewBox="0 0 320 160"
      role="img"
      aria-label="Energy-level diagram: three discrete levels labeled The Signal, The Round, and Patrons and Partners, with an excitation arrow from the ground state to The Round labeled h-nu, apply"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Plate stroke language (shared with figs 02/04): line 1.4 on
          --fig-stroke, emphasis 1.75 on accent, non-scaling weights. */}
      {LEVELS.map((l) => (
        <g key={l.n}>
          <line
            x1="14"
            y1={l.y}
            x2="130"
            y2={l.y}
            stroke={l.n === 2 ? 'var(--accent-display)' : 'var(--fig-stroke)'}
            strokeWidth={l.n === 2 ? 1.75 : 1.4}
            vectorEffect="non-scaling-stroke"
          />
          <text x="138" y={l.y - 2} className="el-name">
            {l.label}
          </text>
          <text x="138" y={l.y + 11} className="el-sub">
            {l.sub}
          </text>
          <text x="0" y={l.y + 3.5} className="el-e">
            E<tspan dy="3" fontSize="7">{l.n}</tspan>
          </text>
        </g>
      ))}
      {/* hν excitation: ground state -> The Round */}
      <defs>
        <ArrowMarker id="el-arrow" />
      </defs>
      <g className="el-excite">
        <line
          x1="72"
          y1="122"
          x2="72"
          y2="96"
          stroke="var(--accent-display)"
          strokeWidth="1.4"
          markerEnd="url(#el-arrow)"
          vectorEffect="non-scaling-stroke"
        />
        <text x="80" y="112" className="el-hv">
          hν — apply
        </text>
      </g>
    </svg>
  )
}
