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
      // Hard error, not a dismissible warning: screen readers and
      // image-blocking email clients render nothing else.
      validation: (r) => r.required().error('Alt text is required — screen readers and image-blocking email clients depend on it'),
    }),
    defineField({ name: 'caption', type: 'string' }),
  ],
  preview: { select: { title: 'caption', subtitle: 'alt', media: 'image' } },
})
