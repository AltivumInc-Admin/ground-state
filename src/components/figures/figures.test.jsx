import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import WaveParticle from './WaveParticle.jsx'
import EnergyLevels from './EnergyLevels.jsx'
import FigCaption from './FigCaption.jsx'

/* The pure SVG figures are deterministic render functions — and they are
   also the fallbacks the 3D figures degrade to, so a silent regression
   here reaches every no-WebGL and reduced-motion visitor. */

describe('WaveParticle (fig. 02)', () => {
  it('exposes its accessible name and draws the full sample row', () => {
    const { container } = render(<WaveParticle />)
    expect(
      screen.getByRole('img', { name: /wave-particle duality/i }),
    ).toBeInTheDocument()
    expect(container.querySelectorAll('circle')).toHaveLength(16)
    expect(container.querySelector('path')).not.toBeNull()
  })
})

describe('EnergyLevels (fig. 03)', () => {
  it('exposes its accessible name and all three tier levels', () => {
    render(<EnergyLevels />)
    expect(
      screen.getByRole('img', { name: /energy-level diagram/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('The Signal')).toBeInTheDocument()
    expect(screen.getByText('The Round')).toBeInTheDocument()
    expect(screen.getByText('Patrons & Partners')).toBeInTheDocument()
    expect(screen.getByText('hν — apply')).toBeInTheDocument()
  })
})

describe('FigCaption', () => {
  it('renders the figure tag and caption text', () => {
    render(<FigCaption num="02">Both are the network.</FigCaption>)
    expect(screen.getByText('fig. 02')).toBeInTheDocument()
    expect(screen.getByText('Both are the network.')).toBeInTheDocument()
  })
})
