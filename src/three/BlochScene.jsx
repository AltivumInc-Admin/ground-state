import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'

/*
 * fig. 04, live — a Bloch sphere with the state vector held in
 * superposition between |0⟩ and |1⟩, precessing about the measurement
 * axis at constant polar angle (free evolution under H ∝ σz: θ fixed,
 * φ advancing). Drag rotates the view about the vertical axis only,
 * so the poles — and their HTML labels — stay put.
 */

const GHOST = '#f7f7ff'
const POWDER = '#c1d8e2'
const SAND = '#b7a781'
const R = 1.6
const THETA = 0.96 // polar angle of ψ — fixed during free precession

/* Reused across frames — the precession tip is recomputed every frame, and
   allocating a fresh Vector3 60×/s only feeds the garbage collector. */
const TIP = new THREE.Vector3()

function circleGeometry(builder, segments = 96) {
  const pts = []
  for (let i = 0; i <= segments; i++) {
    pts.push(builder((i / segments) * Math.PI * 2))
  }
  return new THREE.BufferGeometry().setFromPoints(pts)
}

function Sphere({ yawRef, draggingRef }) {
  const groupRef = useRef(null)
  const vecRef = useRef(null)
  const tipRef = useRef(null)
  const projRef = useRef(null)
  const phiRef = useRef(0.6)

  const geos = useMemo(() => {
    const equator = circleGeometry((a) => new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R))
    const meridianA = circleGeometry((a) => new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0))
    const meridianB = circleGeometry((a) => new THREE.Vector3(0, Math.sin(a) * R, Math.cos(a) * R))
    const latN = circleGeometry(
      (a) => new THREE.Vector3(Math.cos(a) * R * 0.62, R * 0.785, Math.sin(a) * R * 0.62),
    )
    const latS = circleGeometry(
      (a) => new THREE.Vector3(Math.cos(a) * R * 0.62, -R * 0.785, Math.sin(a) * R * 0.62),
    )
    // The precession path: the circle ψ actually traces at θ
    const path = circleGeometry(
      (a) =>
        new THREE.Vector3(
          Math.cos(a) * R * Math.sin(THETA),
          R * Math.cos(THETA),
          Math.sin(a) * R * Math.sin(THETA),
        ),
    )
    const axis = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -R * 1.18, 0),
      new THREE.Vector3(0, R * 1.18, 0),
    ])
    const vector = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ])
    const projection = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ])
    return { equator, meridianA, meridianB, latN, latS, path, axis, vector, projection }
  }, [])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    // Free precession; pauses while the visitor holds the sphere
    if (!draggingRef.current) phiRef.current += dt * 0.45
    const phi = phiRef.current

    const p = TIP.set(
      R * Math.sin(THETA) * Math.cos(phi),
      R * Math.cos(THETA),
      R * Math.sin(THETA) * Math.sin(phi),
    )
    vecRef.current.geometry.attributes.position.setXYZ(1, p.x, p.y, p.z)
    vecRef.current.geometry.attributes.position.needsUpdate = true
    tipRef.current.position.copy(p)
    projRef.current.geometry.attributes.position.setXYZ(0, p.x, p.y, p.z)
    projRef.current.geometry.attributes.position.setXYZ(1, 0, p.y, 0)
    projRef.current.geometry.attributes.position.needsUpdate = true

    // Damped approach to the dragged yaw
    const g = groupRef.current
    g.rotation.y += (yawRef.current - g.rotation.y) * (1 - Math.exp(-dt * 6))
  })

  return (
    <group ref={groupRef} rotation={[0.16, 0, 0]}>
      <line geometry={geos.equator}>
        <lineBasicMaterial color={GHOST} transparent opacity={0.38} />
      </line>
      <line geometry={geos.meridianA}>
        <lineBasicMaterial color={GHOST} transparent opacity={0.22} />
      </line>
      <line geometry={geos.meridianB}>
        <lineBasicMaterial color={GHOST} transparent opacity={0.22} />
      </line>
      <line geometry={geos.latN}>
        <lineBasicMaterial color={GHOST} transparent opacity={0.12} />
      </line>
      <line geometry={geos.latS}>
        <lineBasicMaterial color={GHOST} transparent opacity={0.12} />
      </line>
      <line geometry={geos.axis}>
        <lineBasicMaterial color={GHOST} transparent opacity={0.5} />
      </line>
      <line geometry={geos.path}>
        <lineBasicMaterial color={POWDER} transparent opacity={0.4} />
      </line>
      <line ref={vecRef} geometry={geos.vector}>
        <lineBasicMaterial color={POWDER} transparent opacity={0.95} />
      </line>
      <line ref={projRef} geometry={geos.projection}>
        <lineBasicMaterial color={SAND} transparent opacity={0.45} />
      </line>
      <mesh ref={tipRef}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshBasicMaterial color={POWDER} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshBasicMaterial color={GHOST} />
      </mesh>
    </group>
  )
}

export default function BlochScene({ yawRef, draggingRef, active = true }) {
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 1.75]}
      camera={{ position: [0, 0.4, 5.1], fov: 40, near: 0.1, far: 20 }}
      gl={{ antialias: true, alpha: true }}
    >
      <Sphere yawRef={yawRef} draggingRef={draggingRef} />
    </Canvas>
  )
}
