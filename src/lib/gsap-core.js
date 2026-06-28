import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

// The eager core every route can afford: gsap + ScrollTrigger + useGSAP.
// The choreography plugins (SplitText, DrawSVGPlugin) are deliberately NOT
// registered here — they ride a runtime async chunk loaded by fx.jsx only when
// a [data-split]/[data-draw] element is actually on the page (i.e. / and /story).
// Keeping them out of this module is what keeps them out of the preloaded gsap chunk.
gsap.registerPlugin(ScrollTrigger, useGSAP)

/* Every tween in the app runs behind this media query. Under
   prefers-reduced-motion the tweens simply never register, so the
   page renders complete and static — no hidden states to undo. */
export const MOTION_OK = '(prefers-reduced-motion: no-preference)'

export { gsap, ScrollTrigger, useGSAP }
