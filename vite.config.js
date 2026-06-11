import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/*
 * Critical fonts preload in parallel with the JS bundle. Without the hints
 * they are discovered only after CSS parse + layout — the hero wordmark
 * (the LCP element) then paints in a fallback face and reflows on swap.
 * Filenames are hashed, so the hrefs resolve from the build bundle.
 */
const PRELOAD_FONTS = [
  /^assets\/archivo-latin-wdth-normal-[^.]+\.woff2$/,
  /^assets\/ibm-plex-mono-latin-400-normal-[^.]+\.woff2$/,
  /^assets\/ibm-plex-mono-latin-500-normal-[^.]+\.woff2$/,
]

function fontPreload() {
  return {
    name: 'gss-font-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const hits = Object.keys(ctx.bundle ?? {}).filter((f) =>
          PRELOAD_FONTS.some((re) => re.test(f)),
        )
        if (hits.length < PRELOAD_FONTS.length) {
          console.warn(
            `[gss-font-preload] expected ${PRELOAD_FONTS.length} font matches, got ${hits.length} — check the patterns against the bundle`,
          )
        }
        return hits.map((href) => ({
          tag: 'link',
          attrs: {
            rel: 'preload',
            as: 'font',
            type: 'font/woff2',
            // required even same-origin: font requests are CORS-mode,
            // an anonymous-less preload would be fetched twice
            crossorigin: true,
            href: `/${href}`,
          },
          injectTo: 'head-prepend',
        }))
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), fontPreload()],
})
