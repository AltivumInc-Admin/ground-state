import ArrowMarker from './ArrowMarker.jsx'

/*
 * fig. 04 — measurement.
 * A Bloch sphere with the state vector held between |0⟩ and |1⟩:
 * superposition until measured. Applying is the measurement.
 */
export default function BlochSphere() {
  return (
    <svg
      className="bloch-sphere"
      viewBox="0 0 180 190"
      role="img"
      aria-label="A Bloch sphere: a circle with a dashed equator, poles labeled ket zero and ket one, and a state vector pointing between them"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <ArrowMarker id="bs-arrow" />
      </defs>
      {/* Plate stroke language (shared with figs 02/03): guide 1 / line 1.4 /
          emphasis 1.75, dash '3 5', non-scaling weights. */}
      {/* sphere + equator */}
      <circle
        cx="90"
        cy="95"
        r="62"
        fill="none"
        stroke="var(--fig-stroke)"
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
      />
      <ellipse
        cx="90"
        cy="95"
        rx="62"
        ry="19"
        fill="none"
        stroke="var(--fig-stroke)"
        strokeWidth="1"
        strokeDasharray="3 5"
        vectorEffect="non-scaling-stroke"
      />
      {/* z axis */}
      <line
        x1="90"
        y1="22"
        x2="90"
        y2="168"
        stroke="var(--line-strong)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <text x="98" y="22" className="bs-ket">
        |0⟩
      </text>
      <text x="98" y="176" className="bs-ket">
        |1⟩
      </text>
      {/* state vector in superposition */}
      <line
        className="bs-state"
        x1="90"
        y1="95"
        x2="132"
        y2="55"
        stroke="var(--accent-display)"
        strokeWidth="1.75"
        markerEnd="url(#bs-arrow)"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx="90" cy="95" r="2.4" fill="var(--ink)" />
      {/* projection onto the measurement axis */}
      <line
        x1="132"
        y1="55"
        x2="90"
        y2="55"
        stroke="var(--accent-display)"
        strokeWidth="1"
        strokeDasharray="3 5"
        opacity="0.7"
        vectorEffect="non-scaling-stroke"
      />
      <text x="124" y="46" className="bs-psi">
        ψ
      </text>
    </svg>
  )
}
