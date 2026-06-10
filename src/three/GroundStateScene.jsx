import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'

/*
 * The ground state, literally.
 *
 * A harmonic potential well V(r) = ½kr² rendered as a wireframe
 * paraboloid. A hot, dispersed particle cloud relaxes into the
 * ground-state probability density |ψ₀|² — a gaussian of width σ —
 * and stays there, breathing: zero-point motion never stops
 * (Δx·Δp ≥ ħ/2), so the cloud is calm but never frozen.
 * The powder ring marks E₀ = ½ħω, the zero-point energy, at the
 * classical turning radius r₀ = σ√2.
 *
 * Scroll feeds energy back in (the cloud excites and spreads);
 * releasing lets it relax to the ground state again.
 */

const BLACK = '#08080a'
const GHOST = '#f7f7ff'
const POWDER = '#c1d8e2'
const SAND = '#b7a781'

const N = 2400
const WELL_K = 0.22 // V(r) = WELL_K · r²  (½k folded into the constant)
const SIGMA = 1.05 // ground-state width
const R0 = SIGMA * Math.SQRT2 // classical turning radius of E₀
const E0_Y = WELL_K * R0 * R0 // height of the zero-point energy ring
const WELL_RIM = 3.4

/* Deterministic RNG — the scene composes identically on every load. */
function mulberry32(seed) {
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

function buildCloud(reduced) {
  const rand = mulberry32(2026)
  const targets = new Float32Array(N * 3)
  const positions = new Float32Array(N * 3)
  const phases = new Float32Array(N)
  const rates = new Float32Array(N)
  const colors = new Float32Array(N * 3)

  const ghost = new THREE.Color(GHOST)
  const powder = new THREE.Color(POWDER)
  const sand = new THREE.Color(SAND)

  for (let i = 0; i < N; i++) {
    // Ground-state target: |ψ₀|² is gaussian in the plane; the dot
    // rests on the well surface at its sampled radius.
    const [gx, gz] = gaussianPair(rand)
    const tx = gx * SIGMA
    const tz = gz * SIGMA
    const ty = WELL_K * (tx * tx + tz * tz) + 0.05 + rand() * 0.05
    targets.set([tx, ty, tz], i * 3)

    // Hot start: dispersed wide and high — an excited ensemble.
    const theta = rand() * Math.PI * 2
    const rr = 1.5 + Math.pow(rand(), 0.6) * 5.5
    const sx = Math.cos(theta) * rr
    const sz = Math.sin(theta) * rr
    const sy = 0.6 + rand() * 4.6
    if (reduced) {
      positions.set([tx, ty, tz], i * 3)
    } else {
      positions.set([sx, sy, sz], i * 3)
    }

    phases[i] = rand() * Math.PI * 2
    rates[i] = 0.55 + rand() * 0.9

    const roll = rand()
    const c = roll < 0.78 ? ghost : roll < 0.94 ? powder : sand
    colors.set([c.r, c.g, c.b], i * 3)
  }
  return { targets, positions, phases, rates, colors }
}

function dotTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function ParticleCloud({ energyRef, reduced }) {
  const geomRef = useRef(null)
  const tRef = useRef(0)
  const { targets, positions, phases, rates, colors } = useMemo(
    () => buildCloud(reduced),
    [reduced],
  )
  const map = useMemo(dotTexture, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    tRef.current += dt
    const t = tRef.current
    const energy = energyRef?.current ?? 0
    const geom = geomRef.current
    if (!geom) return
    const pos = geom.attributes.position.array

    // Zero-point breathing amplitude, swollen by injected energy
    const zp = 0.085 * (1 + 5.5 * energy)
    const spread = 1 + 1.9 * energy

    for (let i = 0; i < N; i++) {
      const j = i * 3
      const ph = phases[i]
      const sp = rates[i]

      const bx = targets[j] * spread + zp * Math.sin(t * sp * 1.7 + ph)
      const bz = targets[j + 2] * spread + zp * Math.cos(t * sp * 1.4 + ph * 1.3)
      const by =
        WELL_K * (bx * bx + bz * bz) +
        0.05 +
        zp * 0.6 * (1 + Math.sin(t * sp + ph * 2.1)) +
        energy * 0.5 * (0.5 + 0.5 * Math.sin(t * 2.2 * sp + ph))

      // Critically damped relaxation toward the (breathing) target
      const k = 1 - Math.exp(-dt * sp * 1.1)
      pos[j] += (bx - pos[j]) * k
      pos[j + 1] += (by - pos[j + 1]) * k
      pos[j + 2] += (bz - pos[j + 2]) * k
    }
    geom.attributes.position.needsUpdate = true
  })

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={map}
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        size={0.09}
        sizeAttenuation
        opacity={0.85}
      />
    </points>
  )
}

/* Wireframe paraboloid: concentric rings at y = k·r² plus diametric
   parabola sections — the potential well as architectural line art. */
function Well() {
  const { rings, rails, e0ring } = useMemo(() => {
    const ringGeoms = []
    for (let r = 0.7; r <= WELL_RIM + 0.01; r += 0.45) {
      const pts = []
      const y = WELL_K * r * r
      for (let s = 0; s <= 96; s++) {
        const a = (s / 96) * Math.PI * 2
        pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r))
      }
      ringGeoms.push(new THREE.BufferGeometry().setFromPoints(pts))
    }

    const railGeoms = []
    for (let a = 0; a < 4; a++) {
      const ang = (a / 4) * Math.PI
      const pts = []
      for (let s = 0; s <= 72; s++) {
        const x = -WELL_RIM + (2 * WELL_RIM * s) / 72
        pts.push(
          new THREE.Vector3(Math.cos(ang) * x, WELL_K * x * x, Math.sin(ang) * x),
        )
      }
      railGeoms.push(new THREE.BufferGeometry().setFromPoints(pts))
    }

    const e0pts = []
    for (let s = 0; s <= 96; s++) {
      const a = (s / 96) * Math.PI * 2
      e0pts.push(new THREE.Vector3(Math.cos(a) * R0, E0_Y, Math.sin(a) * R0))
    }
    return {
      rings: ringGeoms,
      rails: railGeoms,
      e0ring: new THREE.BufferGeometry().setFromPoints(e0pts),
    }
  }, [])

  return (
    <group>
      {rings.map((g, i) => (
        <line key={`ring-${i}`} geometry={g}>
          <lineBasicMaterial color={GHOST} transparent opacity={0.17} />
        </line>
      ))}
      {rails.map((g, i) => (
        <line key={`rail-${i}`} geometry={g}>
          <lineBasicMaterial color={GHOST} transparent opacity={0.26} />
        </line>
      ))}
      {/* E₀ = ½ħω — the zero-point energy level */}
      <line geometry={e0ring}>
        <lineBasicMaterial color={POWDER} transparent opacity={0.7} />
      </line>
    </group>
  )
}

function Rig({ reduced }) {
  useFrame(({ camera, clock }) => {
    if (reduced) return
    const t = clock.elapsedTime
    camera.position.x = Math.sin(t * 0.05) * 0.7
    camera.position.y = 2.7 + Math.sin(t * 0.04) * 0.12
    camera.lookAt(0, 0.85, 0)
  })
  return null
}

export default function GroundStateScene({ energyRef, reduced = false, active = true }) {
  return (
    <Canvas
      frameloop={reduced ? 'demand' : active ? 'always' : 'never'}
      dpr={[1, 1.75]}
      camera={{ position: [0, 2.7, 7.4], fov: 42, near: 0.1, far: 30 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={[BLACK]} />
      <fog attach="fog" args={[BLACK, 7.5, 14]} />
      <Rig reduced={reduced} />
      <Well />
      <ParticleCloud energyRef={energyRef} reduced={reduced} />
    </Canvas>
  )
}
