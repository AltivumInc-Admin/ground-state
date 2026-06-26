import { PortableText } from '@portabletext/react'

const components = {
  block: {
    h2: ({ children }) => <h2>{children}</h2>,
    h3: ({ children }) => <h3>{children}</h3>,
    blockquote: ({ children }) => <blockquote>{children}</blockquote>,
    normal: ({ children }) => <p>{children}</p>,
  },
  marks: {
    link: ({ children, value }) => {
      const href = value?.href ?? '#'
      const external = !href.startsWith('/')
      return (
        <a
          href={href}
          {...(external ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
        >
          {children}
        </a>
      )
    },
  },
  types: {
    pteImage: ({ value }) => {
      if (!value?.url) return null
      return (
        <figure className="issue-figure">
          <img src={value.url} alt={value.alt ?? ''} loading="lazy" decoding="async" />
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
