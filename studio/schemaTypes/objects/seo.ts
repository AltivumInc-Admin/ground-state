import { defineType, defineField } from 'sanity'

// Field names (title/description/image/noIndex) match the build's GROQ
// projection in scripts/fetch-issues.mjs — keep them in sync.
export const seo = defineType({
  name: 'seo',
  title: 'SEO',
  type: 'object',
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({
      name: 'title',
      title: 'SEO title',
      type: 'string',
      description: 'Overrides the issue title in search/social. Falls back to the title.',
      validation: (r) => r.max(70).warning('Keep under 70 characters'),
    }),
    defineField({
      name: 'description',
      title: 'SEO description',
      type: 'text',
      rows: 3,
      description: 'Falls back to the excerpt.',
      validation: (r) => r.max(160).warning('Keep under 160 characters'),
    }),
    defineField({
      name: 'image',
      title: 'Social share image',
      type: 'image',
      options: { hotspot: true },
      description: '1200x630 recommended.',
    }),
    defineField({
      name: 'noIndex',
      title: 'Hide from search engines',
      type: 'boolean',
      initialValue: false,
    }),
  ],
})
