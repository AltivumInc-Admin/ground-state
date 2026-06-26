import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './schemaTypes'
import { structure } from './src/structure'

export default defineConfig({
  name: 'default',
  title: 'The Ground State Society — The Signal',
  projectId: 'pe7zq1it',
  dataset: 'production',
  plugins: [structureTool({ structure }), visionTool()],
  schema: { types: schemaTypes },
})
