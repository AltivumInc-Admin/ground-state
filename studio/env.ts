/*
 * The one place the Sanity project coordinates live — sanity.config.ts and
 * sanity.cli.ts both import from here so they cannot drift. The projectId is
 * public by design (it ships in the site bundle's GROQ fetches); this dedup
 * is for drift, not secrecy.
 */
export const projectId = 'pe7zq1it'
export const dataset = 'production'
