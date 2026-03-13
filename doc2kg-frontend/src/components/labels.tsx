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

type Labels = typeof LABELS[number];

export const LABEL_COLORS: Record<Labels, string> = {
  Document: '#E53E3E',
  Section: '#3182CE',
  Information: '#718096',
  Requirement: '#32a822',
  Guidance: '#105f00',
  Reference: '#718096',
  Definition: '#241717',
  Table: '#dcdf43',
  Diagram: '#685c28'
};