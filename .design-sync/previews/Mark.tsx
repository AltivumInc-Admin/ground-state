import { Mark } from 'ground-state-society-landing'

// The brand mark: a potential well with the zero-point energy level E0 and the
// particle settled at the minimum — "the ground state". Scales cleanly; colors
// resolve through the ground tokens so it works on light and dark panels.

export const Default = () => <Mark size={48} />

export const Sizes = () => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 28 }}>
    <Mark size={26} />
    <Mark size={48} />
    <Mark size={96} />
  </div>
)

export const OnDarkPanel = () => (
  <div className="ground-dark" style={{ padding: 40, display: 'inline-flex' }}>
    <Mark size={72} />
  </div>
)
