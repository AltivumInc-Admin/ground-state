import { defineType, defineArrayMember } from 'sanity'

// Styles/decorators/annotations here are limited to what the public renderer
// (src/components/IssueBody.jsx) actually styles: h2/h3/blockquote/normal,
// bullet/number lists, strong/em, a `link` annotation with `href`, and images.
export const blockContent = defineType({
  name: 'blockContent',
  title: 'Body',
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [
        { title: 'Normal', value: 'normal' },
        { title: 'Heading 2', value: 'h2' },
        { title: 'Heading 3', value: 'h3' },
        { title: 'Quote', value: 'blockquote' },
      ],
      lists: [
        { title: 'Bullet', value: 'bullet' },
        { title: 'Numbered', value: 'number' },
      ],
      marks: {
        decorators: [
          { title: 'Strong', value: 'strong' },
          { title: 'Emphasis', value: 'em' },
        ],
        annotations: [
          {
            name: 'link',
            type: 'object',
            title: 'Link',
            fields: [
              {
                name: 'href',
                type: 'url',
                title: 'URL',
                validation: (r) => r.uri({ scheme: ['http', 'https', 'mailto'] }),
              },
            ],
          },
        ],
      },
    }),
    defineArrayMember({ type: 'pteImage' }),
  ],
})
