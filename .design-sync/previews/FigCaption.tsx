import { FigCaption } from 'ground-state-society-landing'

// Lab-notebook caption for the numbered quantum figures: a "fig. NN" tag, the
// caption text, and an optional Dirac ket. Used beneath the Bloch/energy figures.

export const WithKet = () => (
  <FigCaption num="01" ket="|0⟩">
    The ground state — the particle settled at the potential minimum, at zero-point energy E₀.
  </FigCaption>
)

export const Plain = () => (
  <FigCaption num="02">
    Energy levels map to the membership tiers: the Signal sits at the ground state, free.
  </FigCaption>
)
