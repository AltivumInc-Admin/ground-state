import { Mosaic } from 'ground-state-society-landing'

// Decorative pixel mosaic — grayscale cells stepping off the panel corner (the
// house signature). Deterministic per seed. Purely decorative (aria-hidden), and
// designed to sit on the dark "ground-dark" panels, so it's shown on one here.

export const OnDarkPanel = () => (
  <div
    className="ground-dark"
    style={{ position: 'relative', padding: 48, minHeight: 180, overflow: 'hidden' }}
  >
    <Mosaic className="mosaic-corner" cols={12} rows={4} seed={71} />
  </div>
)

export const DenserSeed = () => (
  <div
    className="ground-dark"
    style={{ position: 'relative', padding: 48, minHeight: 180, overflow: 'hidden' }}
  >
    <Mosaic className="mosaic-corner" cols={16} rows={6} seed={29} />
  </div>
)
