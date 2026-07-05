/*
 * Pure CPU-side pieces of the WebGPU hero scene (GroundStateSceneGPU.jsx):
 * the device tier and the seeded initial-buffer build. Kept free of three/tsl
 * imports so they unit-test under jsdom without pulling the renderer.
 */
import { GHOST, POWDER, SAND } from '../lib/palette.js'

/* '#rrggbb' → [r, g, b] in 0..1 — palette.js stays the single color source. */
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)

/* Deterministic RNG — same generator (and seed, in the scene) as the WebGL
   cloud, so the GPU field composes identically on every load. */
export function mulberry32(seed) {
  let t = seed
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/* Box–Muller, seeded */
function gaussianPair(rand) {
  const u = Math.max(rand(), 1e-9)
  const v = rand()
  const m = Math.sqrt(-2 * Math.log(u))
  return [m * Math.cos(2 * Math.PI * v), m * Math.sin(2 * Math.PI * v)]
}

/* Particle-count tier. The per-particle compute is trivial; the real budget
   is additive-sprite fill rate, so the tier keys on the coarse signals a
   browser exposes: physical cores and (where present) coarse device class.
   Deliberately conservative — the fallback for "can't tell" is the low tier. */
export function particleTier(nav = typeof navigator === 'undefined' ? {} : navigator) {
  const cores = nav.hardwareConcurrency ?? 0
  const mobile = /Mobi|Android/i.test(nav.userAgent ?? '')
  if (!mobile && cores >= 8) return 180_000
  if (!mobile && cores >= 4) return 120_000
  return 70_000
}

/*
 * Initial GPU buffers, seeded. Mirrors the WebGL scene's buildCloud
 * (targets = |ψ₀|² gaussian resting on the well; hot dispersed start unless
 * reduced) and adds the two GPU-only channels: per-particle color as a raw
 * vec3 array, and the tunnel tag — the small deterministic subset allowed a
 * through-the-barrier excursion when scroll energy is high.
 */
export function buildCloudGPU(
  n,
  reduced,
  { seed = 2026, sigma = 1.05, wellK = 0.22, tunnelShare = 0.015 } = {},
) {
  const rand = mulberry32(seed)
  const targets = new Float32Array(n * 3)
  const positions = new Float32Array(n * 3)
  const phases = new Float32Array(n)
  const rates = new Float32Array(n)
  const tunnels = new Float32Array(n)
  const colors = new Float32Array(n * 3)

  // Palette shares, matching the WebGL cloud: ghost 78%, powder 16%, sand 6%.
  const ghost = rgb(GHOST)
  const powder = rgb(POWDER)
  const sand = rgb(SAND)

  for (let i = 0; i < n; i++) {
    const [gx, gz] = gaussianPair(rand)
    const tx = gx * sigma
    const tz = gz * sigma
    const ty = wellK * (tx * tx + tz * tz) + 0.05 + rand() * 0.05
    targets.set([tx, ty, tz], i * 3)

    const theta = rand() * Math.PI * 2
    const rr = 1.5 + Math.pow(rand(), 0.6) * 5.5
    if (reduced) {
      positions.set([tx, ty, tz], i * 3)
    } else {
      positions.set([Math.cos(theta) * rr, 0.6 + rand() * 4.6, Math.sin(theta) * rr], i * 3)
    }

    phases[i] = rand() * Math.PI * 2
    rates[i] = 0.55 + rand() * 0.9
    tunnels[i] = rand() < tunnelShare ? 1 : 0

    const roll = rand()
    const c = roll < 0.78 ? ghost : roll < 0.94 ? powder : sand
    colors.set(c, i * 3)
  }
  return { targets, positions, phases, rates, tunnels, colors }
}
