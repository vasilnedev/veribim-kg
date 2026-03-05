export const LABELS = [
  'Document',
  'Section',
  'Information',
  'Requirement',
  'Guidance',
  'Reference',
  'Definition',
  'Table',
  'Diagram'
] as const;

export type Labels = typeof LABELS[number];