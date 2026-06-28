import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { ScrollTrigger } from './lib/gsap-core.js'
import { initMagnetic } from './lib/magnetic.js'

/* Archivo is self-hosted with font-display:optional in tokens.css (no
   fontsource import) so the hero wordmark never swap-reflows. */
/* No italic face: the one <em> phrase (.signal h3 em) renders as a
   synthesized oblique — 101.68 kB of latin italic stays off the wire */
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/700.css'

import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'

// Re-measure scroll choreography once the real typefaces arrive —
// Archivo wide at display sizes can shift line counts under SplitText.
if (document.fonts?.ready) {
  document.fonts.ready.then(() => ScrollTrigger.refresh())
}

initMagnetic()

const container = document.getElementById('root')
const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)

/* Prerendered files (/, /story) stamp #root with data-route. The Amplify
   catch-all serves the LANDING html for every other extensionless path, so we
   hydrate ONLY when the served markup matches the current path — hydrating
   /apply (or /story before its rewrite is live) against landing markup would
   mismatch. Non-matching routes clear and client-render exactly as before. */
if (container.firstChild && container.dataset.route === window.location.pathname) {
  hydrateRoot(container, app)
} else {
  container.textContent = ''
  // The flag rides the prerendered markup — once that's wiped, a later
  // client-side visit deserves its entrance animation.
  delete container.dataset.prerendered
  createRoot(container).render(app)
}
