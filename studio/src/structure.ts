import type { StructureResolver } from 'sanity/structure'
import { DocumentTextIcon } from '@sanity/icons'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('The Signal')
    .items([S.documentTypeListItem('issue').title('Issues').icon(DocumentTextIcon)])
