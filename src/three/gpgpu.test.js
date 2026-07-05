import { describe, expect, it } from 'vitest'
import { buildCloudGPU, particleTier } from './gpgpu.js'

describe('particleTier', () => {
  it('gives desktops with many cores the full field', () => {
    expect(particleTier({ hardwareConcurrency: 12, userAgent: 'Macintosh' })).toBe(180_000)
  })

  it('gives mid desktops the middle tier', () => {
    expect(particleTier({ hardwareConcurrency: 4, userAgent: 'Macintosh' })).toBe(120_000)
  })

  it('gives mobile devices the low tier regardless of cores', () => {
    expect(particleTier({ hardwareConcurrency: 10, userAgent: 'Mobile Android' })).toBe(70_000)
  })

  it('falls back to the low tier when the hardware is unreadable', () => {
    expect(particleTier({})).toBe(70_000)
  })
})

describe('buildCloudGPU', () => {
  it('is deterministic — same seed, same field', () => {
    const a = buildCloudGPU(500, false)
    const b = buildCloudGPU(500, false)
    expect([...a.positions]).toEqual([...b.positions])
    expect([...a.targets]).toEqual([...b.targets])
    expect([...a.colors]).toEqual([...b.colors])
    expect([...a.tunnels]).toEqual([...b.tunnels])
  })

  it('starts reduced clouds already settled at their targets', () => {
    const { positions, targets } = buildCloudGPU(300, true)
    expect([...positions]).toEqual([...targets])
  })

  it('starts unreduced clouds hot — dispersed away from the targets', () => {
    const { positions, targets } = buildCloudGPU(300, false)
    expect([...positions]).not.toEqual([...targets])
  })

  it('tags roughly the configured tunnel share', () => {
    const { tunnels } = buildCloudGPU(10_000, false)
    const share = tunnels.reduce((s, t) => s + t, 0) / tunnels.length
    expect(share).toBeGreaterThan(0.005)
    expect(share).toBeLessThan(0.03)
  })

  it('emits palette colors in the 0..1 range', () => {
    const { colors } = buildCloudGPU(200, false)
    expect(colors.length).toBe(600)
    for (const c of colors) {
      expect(c).toBeGreaterThanOrEqual(0)
      expect(c).toBeLessThanOrEqual(1)
    }
  })
})
