import { MotionToggle } from 'ground-state-society-landing'

// The WCAG 2.2.2 pause/resume control placed beside each auto-animating scene.
// Mounts client-only and hides itself under prefers-reduced-motion (the scenes
// are already static there). Shown here in its default running state.

export const Default = () => <MotionToggle />

export const BesideAScene = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    <span className="label" style={{ opacity: 0.55 }}>Ground-state scene</span>
    <MotionToggle />
  </div>
)
