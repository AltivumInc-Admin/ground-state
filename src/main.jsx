import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { ScrollTrigger } from './lib/fx.jsx'
import { initMagnetic } from './lib/magnetic.js'

import '@fontsource-variable/archivo/wdth.css'
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
