import * as THREE from 'three'

/* Shared primitives for the two R3F scenes (hero cloud, Bloch sphere). */

/* Clamp a raw frame delta — a return from a background tab can hand
   useFrame a multi-second dt, which would teleport the simulations. */
export const clampDt = (rawDt) => Math.min(rawDt, 0.05)

/* Points of a closed loop sampled from builder(angle) → Vector3. */
export function circlePoints(builder, segments = 96) {
  const pts = []
  for (let i = 0; i <= segments; i++) {
    pts.push(builder((i / segments) * Math.PI * 2))
  }
  return pts
}

/* Closed line-loop geometry from a builder(angle) → Vector3. */
export function circleGeometry(builder, segments = 96) {
  return new THREE.BufferGeometry().setFromPoints(circlePoints(builder, segments))
}
