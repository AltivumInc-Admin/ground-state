/* Decorative pixel mosaic — clusters of grayscale cells stepping off
   the panel edges (the DOSS signature). Deterministic per seed so the
   composition is stable across loads. Purely decorative. */
function mulberry32(seed) {
  let t = seed
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const STEPS = [0, 0, 0, 0.06, 0.06, 0.12, 0.12, 0.2, 0.32, 0.5]

export default function Mosaic({ cols = 9, rows = 4, seed = 11, className = '' }) {
  const rand = mulberry32(seed)
  const cells = Array.from({ length: cols * rows }, (_, i) => {
    // Density decays away from the panel corner so clusters feel
    // like they are dissolving off the edge.
    const col = i % cols
    const row = Math.floor(i / cols)
    const falloff = 1 - (0.5 * col) / cols - (0.3 * row) / rows
    const v = STEPS[Math.floor(rand() * STEPS.length)] * Math.max(falloff, 0)
    return v < 0.04 ? 0 : v
  })

  return (
    <div
      className={`mosaic ${className}`.trim()}
      style={{ '--mosaic-cols': cols }}
      aria-hidden="true"
      data-cells
    >
      {cells.map((opacity, i) => (
        <span key={i} style={opacity ? { opacity } : undefined} />
      ))}
    </div>
  )
}
