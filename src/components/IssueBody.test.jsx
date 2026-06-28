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

  function linkValue(href) {
    return [
      {
        _type: 'block',
        style: 'normal',
        _key: 'b',
        markDefs: [{ _type: 'link', _key: 'l', href }],
        children: [{ _type: 'span', _key: 's', text: 'click me', marks: ['l'] }],
      },
    ]
  }

  it('rejects a javascript: href — renders plain text, not an anchor', () => {
    render(<IssueBody value={linkValue('javascript:alert(1)')} />)
    expect(screen.getByText('click me')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('rejects an empty href — renders plain text, not an inert anchor', () => {
    render(<IssueBody value={linkValue('')} />)
    expect(screen.getByText('click me')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('rejects a protocol-relative //host href (would miss rel/target)', () => {
    render(<IssueBody value={linkValue('//evil.com')} />)
    expect(screen.getByText('click me')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('sizes a Sanity image via CDN params and reserves its dimensions', () => {
    const imageValue = [
      {
        _type: 'pteImage',
        _key: 'i',
        url: 'https://cdn.sanity.io/images/p/d/abc-1600x1000.png',
        dimensions: { width: 1600, height: 1000 },
        alt: 'a figure',
      },
    ]
    render(<IssueBody value={imageValue} />)
    const img = screen.getByRole('img', { name: 'a figure' })
    expect(img.getAttribute('src')).toContain('auto=format')
    expect(img).toHaveAttribute('width', '1600')
    expect(img).toHaveAttribute('height', '1000')
    expect(img).toHaveAttribute('srcset')
  })

  it('renders nothing (no crash) for an image block with no resolved url', () => {
    render(<IssueBody value={[{ _type: 'pteImage', _key: 'i', alt: 'x' }]} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders bullet-list blocks as list items', () => {
    const listValue = [
      { _type: 'block', style: 'normal', listItem: 'bullet', level: 1, _key: '1', markDefs: [], children: [{ _type: 'span', _key: 'a', text: 'item one', marks: [] }] },
      { _type: 'block', style: 'normal', listItem: 'bullet', level: 1, _key: '2', markDefs: [], children: [{ _type: 'span', _key: 'b', text: 'item two', marks: [] }] },
    ]
    const { container } = render(<IssueBody value={listValue} />)
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
    expect(screen.getByText('item one')).toBeInTheDocument()
  })
})
