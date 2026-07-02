/*
 * The published palette as JS — mirrors src/styles/tokens.css
 * (--ghost / --powder / --sand / --black). WebGL can't read CSS custom
 * properties, so the R3F scenes import these instead of hardcoding hexes.
 * A palette change must edit this file and tokens.css together — one
 * source per runtime, never per scene.
 */
export const GHOST = '#f7f7ff'
export const POWDER = '#c1d8e2'
export const SAND = '#b7a781'
export const BLACK = '#08080a'
