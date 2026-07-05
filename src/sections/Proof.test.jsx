import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Proof from './Proof.jsx'
import { stats, networks, matrix, asOfDisplay } from '../lib/signals.js'

describe('Proof section', () => {
  const renderProof = () =>
    render(
      <MemoryRouter>
        <Proof />
      </MemoryRouter>,
    )

  it('renders its heading, a stat, and the comparison table', () => {
    renderProof()
    expect(screen.getByRole('heading', { level: 2, name: /receipts, not vibes/i })).toBeInTheDocument()
    // A stat fallback value (rendered statically; the counter only runs under
    // motion). getAllBy — the funding plate legitimately prints it too.
    expect(screen.getAllByText('$4.1B').length).toBeGreaterThan(0)
    // The comparison table lists the priced peer networks (rowheader — the
    // scatter plate also labels the same names as SVG text).
    expect(screen.getByRole('rowheader', { name: 'Hampton' })).toBeInTheDocument()
  })

  it('renders every stat, network row, and matrix row from the data module', () => {
    renderProof()
    // Stat fallbacks come from the generated display strings — one source.
    // getAllBy: plate annotations may repeat a stat's value.
    for (const s of stats) {
      expect(screen.getAllByText(s.display).length).toBeGreaterThan(0)
    }
    for (const n of networks) {
      expect(screen.getByRole('rowheader', { name: n.name })).toBeInTheDocument()
    }
    for (const row of matrix.rows) {
      expect(screen.getByRole('rowheader', { name: row.attr })).toBeInTheDocument()
    }
  })

  it('renders the three data plates with accessible descriptions', () => {
    renderProof()
    expect(screen.getByRole('img', { name: /venture capital into quantum/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /dense clusters/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /annual price against domain focus/i })).toBeInTheDocument()
    // The lab-notebook numbering continues through the section
    expect(screen.getByText('fig. 03')).toBeInTheDocument()
    expect(screen.getByText('fig. 04')).toBeInTheDocument()
    expect(screen.getByText('fig. 05')).toBeInTheDocument()
  })

  it('stamps the build-guarded as-of date', () => {
    renderProof()
    expect(screen.getByText(new RegExp(`figures as of ${asOfDisplay}`))).toBeInTheDocument()
  })
})
