import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/*
 * Critical fonts preload in parallel with the JS bundle. Without the hints
 * they are discovered only after CSS parse + layout. Archivo is self-hosted
 * (public/fonts) and preloaded by a literal <link> in index.html, so it is no
 * longer matched here; these are the hashed IBM Plex Mono bundle assets.
 */
const PRELOAD_FONTS = [
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
  build: {
    rollupOptions: {
      output: {
        /*
         * Split the long-lived vendor code out of the app chunk. React and
         * GSAP change far less often than the page itself, so giving them
         * their own hashed files lets a returning visitor reuse them across
         * deploys instead of re-downloading them inside every app rebuild.
         * three / @react-three are left alone — they already live in their
         * own chunk behind the hero's dynamic import.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id))
            return 'react-vendor'
          if (/node_modules\/(gsap|@gsap)\//.test(id)) return 'gsap'
          return undefined
        },
      },
    },
  },
  // Frontend tests run on jsdom. Scoped to *.test.* so the production build is
  // unaffected; the font-preload plugin is build-only and never runs here.
  test: {
    environment: 'jsdom',
    globals: true,
    css: false,
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
