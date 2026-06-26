import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import IssueBody from './IssueBody.jsx'

const value = [
  { _type: 'block', style: 'h2', _key: '1', children: [{ _type: 'span', _key: 's1', text: 'A Heading', marks: [] }], markDefs: [] },
  {
    _type: 'block',
    style: 'normal',
    _key: '2',
    markDefs: [{ _type: 'link', _key: 'l1', href: 'https://example.com' }],
    children: [{ _type: 'span', _key: 's2', text: 'a link', marks: ['l1'] }],
  },
  { _type: 'pteImage', _key: '3', url: 'https://cdn.sanity.io/img.png', alt: 'a particle in a well', caption: 'Fig 1' },
]

describe('IssueBody', () => {
  it('renders headings, external links, and images with alt text', () => {
    render(<IssueBody value={value} />)
    expect(screen.getByRole('heading', { level: 2, name: 'A Heading' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'a link' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getByRole('img', { name: 'a particle in a well' })).toBeInTheDocument()
  })

  it('renders nothing for an empty body', () => {
    const { container } = render(<IssueBody value={[]} />)
    expect(container.querySelector('.issue-body')).toBeEmptyDOMElement()
  })

  it('internal link renders without target or rel (FIX 5)', () => {
    const internalValue = [
      {
        _type: 'block',
        style: 'normal',
        _key: '3',
        markDefs: [{ _type: 'link', _key: 'l2', href: '/internal/path' }],
        children: [{ _type: 'span', _key: 's3', text: 'internal link', marks: ['l2'] }],
      },
    ]
    render(<IssueBody value={internalValue} />)
    const link = screen.getByRole('link', { name: 'internal link' })
    expect(link).toHaveAttribute('href', '/internal/path')
    expect(link).not.toHaveAttribute('target')
    expect(link).not.toHaveAttribute('rel')
  })
})
