import { defineType, defineField } from 'sanity'
import { ImageIcon } from '@sanity/icons'

export const pteImage = defineType({
  name: 'pteImage',
  title: 'Image',
  type: 'object',
  icon: ImageIcon,
  fields: [
    defineField({ name: 'image', type: 'image', options: { hotspot: true }, validation: (r) => r.required() }),
    defineField({
      name: 'alt',
      title: 'Alternative text',
      type: 'string',
      validation: (r) => r.required().warning('Alt text is important for accessibility and SEO'),
    }),
    defineField({ name: 'caption', type: 'string' }),
  ],
  preview: { select: { title: 'caption', subtitle: 'alt', media: 'image' } },
})
