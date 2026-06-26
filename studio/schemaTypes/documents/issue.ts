import { defineType, defineField } from 'sanity'
import { DocumentTextIcon } from '@sanity/icons'

export const issue = defineType({
  name: 'issue',
  title: 'Issue',
  type: 'document',
  icon: DocumentTextIcon,
  fields: [
    defineField({ name: 'title', type: 'string', validation: (r) => r.required() }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (r) =>
        r.required().custom((slug) => {
          if (!slug?.current) return 'Required'
          if (!/^[a-z0-9-]+$/.test(slug.current)) return 'Lowercase letters, numbers, and hyphens only'
          return true
        }),
    }),
    defineField({
      name: 'status',
      type: 'string',
      options: {
        list: [
          { title: 'Draft', value: 'draft' },
          { title: 'Published', value: 'published' },
        ],
        layout: 'radio',
      },
      initialValue: 'draft',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
      validation: (r) => r.required(),
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'excerpt',
      type: 'text',
      rows: 3,
      description: 'One-paragraph teaser. Used as the default meta description.',
      validation: (r) => r.required().max(200),
    }),
    defineField({ name: 'body', type: 'blockContent' }),
    defineField({ name: 'seo', type: 'seo' }),
  ],
  orderings: [
    {
      title: 'Published date, newest first',
      name: 'publishedDesc',
      by: [{ field: 'publishedAt', direction: 'desc' }],
    },
  ],
  preview: {
    select: { title: 'title', subtitle: 'status', date: 'publishedAt' },
    prepare: ({ title, subtitle, date }) => ({
      title,
      subtitle: `${subtitle ?? 'draft'} · ${date ? new Date(date).toISOString().slice(0, 10) : 'no date'}`,
    }),
  },
})
