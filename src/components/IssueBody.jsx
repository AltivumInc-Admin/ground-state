import { PortableText } from '@portabletext/react'

// Classify a CMS-authored link href. Only an explicit allowlist renders as an
// anchor: http(s) (external), mailto/tel (contact), or an in-app path. Anything
// else — javascript:/data: (CSP-blocked but still a defense-in-depth + a11y
// hazard), protocol-relative //host, an empty href, or a bare relative string —
// returns null so the serializer renders plain text instead of an inert,
// link-styled, non-focusable anchor.
function classifyLink(rawHref) {
  const href = (rawHref || '').trim()
  if (!href) return null
  // In-app path, but NOT protocol-relative //host.
  if (href.startsWith('/') && !href.startsWith('//')) return { href, external: false }
  const lower = href.toLowerCase()
  if (lower.startsWith('https://') || lower.startsWith('http://')) return { href, external: true }
  if (lower.startsWith('mailto:') || lower.startsWith('tel:')) return { href, external: false }
  return null
}

// Sanity assets are served from cdn.sanity.io and accept transform params, so
// request a sized, auto-formatted (WebP/AVIF) image instead of the full-res
// original. Untransformable URLs (non-Sanity, or already carrying a query) pass
// through unchanged.
function sizedSanityUrl(url, width) {
  if (typeof url !== 'string' || !url.includes('cdn.sanity.io') || url.includes('?')) return url
  return `${url}?w=${width}&auto=format&fit=max&q=75`
}

const components = {
  block: {
    h2: ({ children }) => <h2>{children}</h2>,
    h3: ({ children }) => <h3>{children}</h3>,
    blockquote: ({ children }) => <blockquote>{children}</blockquote>,
    normal: ({ children }) => <p>{children}</p>,
  },
  marks: {
    code: ({ children }) => <code>{children}</code>,
    link: ({ children, value }) => {
      const link = classifyLink(value?.href)
      if (!link) return <>{children}</>
      return (
        <a href={link.href} {...(link.external ? { rel: 'noopener noreferrer', target: '_blank' } : {})}>
          {children}
        </a>
      )
    },
  },
  types: {
    pteImage: ({ value }) => {
      if (!value?.url) return null
      const { width, height } = value.dimensions || {}
      const src = sizedSanityUrl(value.url, 1200)
      // srcset only when the URL was actually transformable (so a 2x variant exists).
      const transformable = src !== value.url
      return (
        <figure className="issue-figure">
          <img
            src={src}
            {...(transformable
              ? {
                  srcSet: `${src} 1200w, ${sizedSanityUrl(value.url, 2000)} 2000w`,
                  sizes: '(min-width: 52rem) 800px, 100vw',
                }
              : {})}
            {...(width ? { width } : {})}
            {...(height ? { height } : {})}
            alt={value.alt ?? ''}
            loading="lazy"
            decoding="async"
          />
          {value.caption ? <figcaption>{value.caption}</figcaption> : null}
        </figure>
      )
    },
  },
}

export default function IssueBody({ value }) {
  return (
    <div className="issue-body">
      {Array.isArray(value) && value.length > 0 ? (
        <PortableText value={value} components={components} />
      ) : null}
    </div>
  )
}
