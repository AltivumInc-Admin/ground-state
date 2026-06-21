// Synth bundle entry for design-sync.
// The landing-page components are all `export default`, which `export *` (the
// converter's auto-synth) cannot reach — so re-export each as a NAMED export
// matching its component name. Passed to package-build.mjs via --entry; esbuild
// bundles this into window.GroundState.*.
//
// Import the design-language CSS here so esbuild extracts it into _ds_bundle.css
// (the components import it globally in src/main.jsx, not themselves). Order
// mirrors main.jsx: tokens (custom properties) -> base -> components.
import '../src/styles/tokens.css'
import '../src/styles/base.css'
import '../src/styles/components.css'

export { default as Mark } from '../src/components/Mark.jsx'
export { default as MotionToggle } from '../src/components/MotionToggle.jsx'
export { default as Mosaic } from '../src/components/Mosaic.jsx'
export { default as Footer } from '../src/components/Footer.jsx'
export { default as Nav } from '../src/components/Nav.jsx'
export { default as Cursor } from '../src/components/Cursor.jsx'
export { default as HeroScene } from '../src/components/HeroScene.jsx'
export { default as FigCaption } from '../src/components/figures/FigCaption.jsx'
export { default as EnergyLevels } from '../src/components/figures/EnergyLevels.jsx'
export { default as WaveParticle } from '../src/components/figures/WaveParticle.jsx'
export { default as BlochFigure } from '../src/components/figures/BlochFigure.jsx'
export { default as BlochSphere } from '../src/components/figures/BlochSphere.jsx'
// BlochScene / GroundStateScene (src/three/*) are excluded: they are the only
// @react-three/fiber roots, and R3F's react-reconciler imports `scheduler`,
// which the converter's vendor-React bundle deliberately rejects — including
// them breaks the whole shared bundle. They are pure WebGL canvases with no
// composable DS use anyway.
export { default as Hero } from '../src/sections/Hero.jsx'
export { default as Problem } from '../src/sections/Problem.jsx'
export { default as Proof } from '../src/sections/Proof.jsx'
export { default as Inside } from '../src/sections/Inside.jsx'
export { default as Story } from '../src/sections/Story.jsx'
export { default as FinalCta } from '../src/sections/FinalCta.jsx'
