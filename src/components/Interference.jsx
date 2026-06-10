/*
 * Hero figure — a two-source interference pattern.
 * Two ring systems whose overlap holds a single chestnut node:
 * the room where the two sides of the quantum economy meet.
 */
const RINGS = [22, 44, 66, 88, 110, 132, 154]

export default function Interference() {
  return (
    <svg
      className="interference"
      viewBox="0 0 420 360"
      role="img"
      aria-label="Two systems of concentric rings interfering, with a single point marked where they overlap"
    >
      <g className="ring-group" style={{ transformOrigin: '150px 180px' }}>
        {RINGS.map((r, i) => (
          <circle
            key={`a-${r}`}
            cx="150"
            cy="180"
            r={r}
            fill="none"
            stroke="#A4988C"
            strokeOpacity={0.85 - i * 0.1}
            strokeWidth="1"
          />
        ))}
      </g>
      <g className="ring-group" style={{ transformOrigin: '270px 180px', animationDirection: 'reverse' }}>
        {RINGS.map((r, i) => (
          <circle
            key={`b-${r}`}
            cx="270"
            cy="180"
            r={r}
            fill="none"
            stroke="#A4988C"
            strokeOpacity={0.85 - i * 0.1}
            strokeWidth="1"
            strokeDasharray={i % 2 ? '3 5' : 'none'}
          />
        ))}
      </g>
      {/* The overlap — the room */}
      <circle cx="210" cy="180" r="34" fill="none" stroke="#B0664E" strokeWidth="1.4" />
      <circle cx="210" cy="180" r="5" fill="#B0664E" />
      <line x1="150" y1="180" x2="270" y2="180" stroke="#B0664E" strokeWidth="1" strokeDasharray="2 6" opacity="0.8" />
      <circle cx="150" cy="180" r="2.5" fill="#05040B" />
      <circle cx="270" cy="180" r="2.5" fill="#05040B" />
    </svg>
  )
}
