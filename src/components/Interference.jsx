/*
 * fig. 01 — two-source interference.
 * Two ring systems whose overlap holds a single accent node, read out
 * below as the double-slit fringe pattern: I(x) ∝ cos²(δ/2) under a
 * diffraction envelope. Where coherent waves overlap, amplitude compounds.
 * Colors come from theme tokens so the figure follows the palette toggle.
 */
const RINGS = [22, 44, 66, 88, 110, 132, 154]

/* Fringe intensity on the screen: cos² carrier under a gaussian envelope */
const FRINGES = Array.from({ length: 41 }, (_, k) => {
  const i = k - 20
  const intensity = Math.cos((i * Math.PI) / 3.4) ** 2 * Math.exp(-((i / 14) ** 2))
  return { x: 210 + i * 5.6, intensity }
})

export default function Interference() {
  return (
    <svg
      className="interference"
      viewBox="0 0 420 372"
      role="img"
      aria-label="Two systems of concentric rings interfering, with a single point marked where they overlap and the resulting interference fringe pattern below"
    >
      <g className="ring-group" style={{ transformOrigin: '150px 170px' }}>
        {RINGS.map((r, i) => (
          <circle
            key={`a-${r}`}
            cx="150"
            cy="170"
            r={r}
            fill="none"
            stroke="var(--mushroom)"
            strokeOpacity={0.85 - i * 0.1}
            strokeWidth="1"
          />
        ))}
      </g>
      <g className="ring-group" style={{ transformOrigin: '270px 170px', animationDirection: 'reverse' }}>
        {RINGS.map((r, i) => (
          <circle
            key={`b-${r}`}
            cx="270"
            cy="170"
            r={r}
            fill="none"
            stroke="var(--mushroom)"
            strokeOpacity={0.85 - i * 0.1}
            strokeWidth="1"
            strokeDasharray={i % 2 ? '3 5' : 'none'}
          />
        ))}
      </g>
      {/* The overlap — the room */}
      <circle cx="210" cy="170" r="34" fill="none" stroke="var(--accent-display)" strokeWidth="1.4" />
      <circle cx="210" cy="170" r="5" fill="var(--accent-display)" />
      <line
        x1="150"
        y1="170"
        x2="270"
        y2="170"
        stroke="var(--accent-display)"
        strokeWidth="1"
        strokeDasharray="2 6"
        opacity="0.8"
      />
      <circle cx="150" cy="170" r="2.5" fill="var(--obsidian)" />
      <circle cx="270" cy="170" r="2.5" fill="var(--obsidian)" />

      {/* The screen: I(x) ∝ cos²(δ/2) · envelope */}
      <line x1="86" y1="352" x2="334" y2="352" stroke="var(--line)" strokeWidth="1" />
      {FRINGES.map((f) => (
        <rect
          key={f.x}
          x={f.x - 1.6}
          y={348 - 18 * f.intensity}
          width="3.2"
          height={18 * f.intensity + 0.5}
          fill="var(--accent-display)"
          opacity={0.25 + 0.6 * f.intensity}
        />
      ))}
    </svg>
  )
}
