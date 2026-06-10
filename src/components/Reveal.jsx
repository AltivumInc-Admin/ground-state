import { useEffect, useRef } from 'react'

/*
 * Scroll-reveal wrapper. Adds .is-in when the element enters the viewport.
 * Falls back to visible immediately when IntersectionObserver is unavailable
 * or the user prefers reduced motion (handled in CSS).
 */
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      node?.classList.add('is-in')
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add('is-in')
          observer.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`.trim()}
      style={delay ? { '--reveal-delay': `${delay}s` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  )
}
