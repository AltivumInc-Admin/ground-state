import signals from '../content/signals.generated.json'

// fetch-signals.mjs owns validation and every derivation (stat display
// strings, the VC multiple, the as-of display date); this module is the thin,
// testable accessor so components never import the generated JSON directly —
// the same contract issues.js has with fetch-issues.mjs.
export const stats = signals.stats
export const funding = signals.funding
export const concentration = signals.concentration
export const networks = signals.networks
export const us = signals.us
export const matrix = signals.matrix
export const asOf = signals.asOf
export const asOfDisplay = signals.asOfDisplay
