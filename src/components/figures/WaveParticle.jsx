/*
 * fig. 02 — wave–particle duality.
 * The same curve ψ(x) drawn twice: a continuous wave on the left,
 * discrete samples of the same curve on the right (dot radius scales
 * with |ψ| for visual weight). Both descriptions are true.
 * Draw-in animates when the parent .reveal enters the viewport.
 */
const W = 720
const H = 120
const MID = H / 2
const AMP = 34
const WAVELENGTH = 120

function y(x) {
  return MID - AMP * Math.sin((2 * Math.PI * x) / WAVELENGTH)
}

/* Continuous wave over the left half */
function wavePath() {
  const steps = 90
  const end = W * 0.52
  let d = `M 0 ${y(0).toFixed(2)}`
  for (let i = 1; i <= steps; i++) {
    const x = (end * i) / steps
    d += ` L ${x.toFixed(2)} ${y(x).toFixed(2)}`
  }
  return d
}

/* Discrete samples of the same function over the right half */
const DOTS = Array.from({ length: 16 }, (_, i) => {
  const x = W * 0.55 + ((W * 0.45 - 18) * i) / 15
  return { x, y: y(x), r: 2.4 + 1.6 * Math.abs(Math.sin((2 * Math.PI * x) / WAVELENGTH)) }
})

export default function WaveParticle() {
  return (
    <svg
      className="wave-particle"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="A continuous sine wave that becomes a row of discrete dots sampling the same curve — wave-particle duality"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Plate stroke language (shared with figs 03/04): guide 1 / line 1.4 /
          emphasis 1.75, dash '3 5', non-scaling so the weights survive every
          viewBox scale (this 720-wide figure went sub-pixel on phones). */}
      <line
        x1="0"
        y1={MID}
        x2={W}
        y2={MID}
        stroke="var(--line-strong)"
        strokeWidth="1"
        strokeDasharray="3 5"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={wavePath()}
        fill="none"
        stroke="var(--fig-stroke)"
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
      />
      {DOTS.map((d, i) => (
        <circle
          key={d.x}
          cx={d.x}
          cy={d.y}
          r={d.r}
          fill={i === DOTS.length - 1 ? 'var(--accent-display)' : 'var(--fig-stroke)'}
        />
      ))}
    </svg>
  )
}
