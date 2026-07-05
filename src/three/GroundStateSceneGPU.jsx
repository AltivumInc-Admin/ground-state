import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import {
  Fn,
  float,
  instanceIndex,
  instancedArray,
  mix,
  smoothstep,
  uniform,
  uv,
  vec3,
} from 'three/tsl'
import { Canvas, useFrame } from '@react-three/fiber'
import { BLACK, GHOST, POWDER } from '../lib/palette.js'
import { clampDt, circleGeometry, circlePoints } from './shared.js'
import { buildCloudGPU, particleTier } from './gpgpu.js'

/*
 * The ground state, literally — the WebGPU edition.
 *
 * Same physics as GroundStateScene.jsx (the WebGL fallback, untouched):
 * a harmonic well V(r) = ½kr², a particle ensemble relaxing into |ψ₀|²
 * and breathing with zero-point motion; scroll injects energy. The
 * difference is scale: the per-particle relaxation runs as a TSL compute
 * kernel on the GPU, so the cloud is a real field — 70k-180k particles by
 * device tier instead of the CPU loop's 2,400 — and high scroll energy
 * lets a small tagged subset TUNNEL through the potential barrier
 * (through the wall at low height, not over it) before re-capture.
 *
 * HeroScene.jsx only mounts this behind navigator.gpu + VITE_WEBGPU=1,
 * with the WebGL scene as the selection fallback and an error boundary
 * that demotes a failed WebGPU init to WebGL at runtime.
 */

const WELL_K = 0.22 // V(r) = WELL_K · r²  (½k folded into the constant)
const SIGMA = 1.05 // ground-state width
const R0 = SIGMA * Math.SQRT2 // classical turning radius of E₀
const E0_Y = WELL_K * R0 * R0 // height of the zero-point energy ring
const WELL_RIM = 3.4

function GPUCloud({ energyRef, reduced }) {
  const built = useMemo(() => {
    const n = particleTier()
    const { targets, positions, phases, rates, tunnels, colors } = buildCloudGPU(n, reduced, {
      sigma: SIGMA,
      wellK: WELL_K,
    })

    const posBuf = instancedArray(positions, 'vec3')
    const targetBuf = instancedArray(targets, 'vec3')
    const phaseBuf = instancedArray(phases, 'float')
    const rateBuf = instancedArray(rates, 'float')
    const tunnelBuf = instancedArray(tunnels, 'float')
    const colorBuf = instancedArray(colors, 'vec3')

    const uEnergy = uniform(0)
    const uTime = uniform(0)
    const uDt = uniform(0)

    // The WebGL scene's per-particle frame math (breathing target +
    // critically damped relaxation), verbatim, as a compute kernel —
    // plus the tunneling excursion, which only the GPU headroom affords.
    const update = Fn(() => {
      const pos = posBuf.element(instanceIndex)
      const target = targetBuf.element(instanceIndex)
      const ph = phaseBuf.element(instanceIndex)
      const sp = rateBuf.element(instanceIndex)
      const tunnel = tunnelBuf.element(instanceIndex)

      // Zero-point breathing amplitude, swollen by injected energy
      const zp = uEnergy.mul(5.5).add(1).mul(0.085).toVar()
      const spread = uEnergy.mul(1.9).add(1).toVar()

      const bx = target.x
        .mul(spread)
        .add(zp.mul(uTime.mul(sp).mul(1.7).add(ph).sin()))
        .toVar()
      const bz = target.z
        .mul(spread)
        .add(zp.mul(uTime.mul(sp).mul(1.4).add(ph.mul(1.3)).cos()))
        .toVar()
      const by = bx
        .mul(bx)
        .add(bz.mul(bz))
        .mul(WELL_K)
        .add(0.05)
        .add(zp.mul(0.6).mul(uTime.mul(sp).add(ph.mul(2.1)).sin().add(1)))
        .add(uEnergy.mul(0.5).mul(uTime.mul(sp).mul(2.2).add(ph).sin().mul(0.5).add(0.5)))
        .toVar()

      const b = vec3(bx, by, bz).toVar()

      // Tunneling: past the energy gate, tagged particles cycle out
      // THROUGH the barrier — radius beyond the rim at near-ground height
      // (a particle without the energy to climb the wall appearing beyond
      // it), then relax home. Cyclic, so every excursion self-recaptures.
      const gate = smoothstep(0.18, 0.5, uEnergy)
      const cyc = uTime.mul(sp).mul(0.35).add(ph.mul(3)).sin().mul(0.5).add(0.5)
      const excursion = tunnel.mul(gate).mul(cyc).toVar()
      const rr = bx.mul(bx).add(bz.mul(bz)).sqrt().max(1e-4)
      const outR = float(WELL_RIM + 1.3)
      const escaped = vec3(bx.div(rr).mul(outR), 0.12, bz.div(rr).mul(outR))
      b.assign(mix(b, escaped, excursion))

      // Critically damped relaxation toward the (breathing) target
      const k = uDt.mul(sp).mul(1.1).negate().exp().oneMinus()
      pos.addAssign(b.sub(pos).mul(k))
    })().compute(n)

    // Soft dot: the WebGL scene's radial-gradient sprite, as nodes.
    // Size and alpha shrink with density — additive blending accumulates,
    // and at 180k sprites the gaussian core would otherwise saturate to a
    // solid blaze, losing the discrete-ensemble granularity that is the
    // whole figure ("even settled, the cloud never freezes").
    const material = new THREE.SpriteNodeMaterial()
    const d = uv().sub(0.5).length().mul(2).clamp(0, 1)
    const falloff = d.oneMinus().pow(1.6)
    material.positionNode = posBuf.toAttribute()
    material.colorNode = colorBuf.toAttribute().mul(falloff)
    material.opacityNode = falloff.mul(n >= 150_000 ? 0.4 : n >= 100_000 ? 0.5 : 0.62)
    material.transparent = true
    material.depthWrite = false
    material.blending = THREE.AdditiveBlending
    material.scaleNode = uniform(n >= 150_000 ? 0.024 : n >= 100_000 ? 0.03 : 0.04)

    const sprite = new THREE.Sprite(material)
    sprite.count = n
    sprite.frustumCulled = false

    return { sprite, material, update, uEnergy, uTime, uDt }
  }, [reduced])

  useEffect(() => {
    const { material } = built
    return () => material.dispose()
  }, [built])

  useFrame((state, rawDt) => {
    if (reduced) return
    const dt = clampDt(rawDt)
    built.uTime.value += dt
    built.uDt.value = dt
    built.uEnergy.value = energyRef?.current ?? 0
    state.gl.compute(built.update)
  })

  return <primitive object={built.sprite} />
}

/* Merge parallel line strips into one segment geometry — same draw-call
   shape as the WebGL scene's Well. */
function segmentsFromStrips(strips) {
  const pts = []
  for (const strip of strips) {
    for (let i = 0; i < strip.length - 1; i++) pts.push(strip[i], strip[i + 1])
  }
  return new THREE.BufferGeometry().setFromPoints(pts)
}

function Well() {
  const { ringSegs, railSegs, e0ring } = useMemo(() => {
    const ringStrips = []
    for (let r = 0.7; r <= WELL_RIM + 0.01; r += 0.45) {
      const y = WELL_K * r * r
      ringStrips.push(
        circlePoints((a) => new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)),
      )
    }

    const railStrips = []
    for (let a = 0; a < 4; a++) {
      const ang = (a / 4) * Math.PI
      const pts = []
      for (let s = 0; s <= 72; s++) {
        const x = -WELL_RIM + (2 * WELL_RIM * s) / 72
        pts.push(
          new THREE.Vector3(Math.cos(ang) * x, WELL_K * x * x, Math.sin(ang) * x),
        )
      }
      railStrips.push(pts)
    }

    return {
      ringSegs: segmentsFromStrips(ringStrips),
      railSegs: segmentsFromStrips(railStrips),
      e0ring: circleGeometry(
        (a) => new THREE.Vector3(Math.cos(a) * R0, E0_Y, Math.sin(a) * R0),
      ),
    }
  }, [])

  return (
    <group>
      <lineSegments geometry={ringSegs}>
        <lineBasicMaterial color={GHOST} transparent opacity={0.17} />
      </lineSegments>
      <lineSegments geometry={railSegs}>
        <lineBasicMaterial color={GHOST} transparent opacity={0.26} />
      </lineSegments>
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

export default function GroundStateSceneGPU({
  energyRef,
  reduced = false,
  active = true,
  onContextLost,
}) {
  // Stable across renders so the async factory closure can't go stale.
  const lostRef = useRef(onContextLost)
  lostRef.current = onContextLost

  return (
    <Canvas
      frameloop={reduced || !active ? 'demand' : 'always'}
      dpr={[1, 1.75]}
      camera={{ position: [0, 2.7, 7.4], fov: 42, near: 0.1, far: 30 }}
      gl={async (props) => {
        // Throws when no adapter/device is available — HeroScene's inner
        // boundary catches that and demotes to the WebGL scene.
        const renderer = new THREE.WebGPURenderer({
          ...props,
          antialias: true,
          powerPreference: 'high-performance',
        })
        await renderer.init()
        // Device loss is the WebGPU analogue of a lost GL context: quiet
        // fallback, never a frozen canvas.
        renderer.backend?.device?.lost?.then?.(() => lostRef.current?.())
        return renderer
      }}
    >
      <color attach="background" args={[BLACK]} />
      <fog attach="fog" args={[BLACK, 7.5, 14]} />
      <Rig reduced={reduced} />
      <Well />
      <GPUCloud energyRef={energyRef} reduced={reduced} />
    </Canvas>
  )
}
