// Canonical site origin — one source of truth for the JS side, shared by the
// client head hook (usePageMeta) and the build-time prerender/sitemap pipeline.
// index.html's static <head> and JSON-LD hardcode the same value (static HTML
// can't import), so keep them in step with this if it ever changes.
export const SITE = 'https://groundstatesociety.com'
