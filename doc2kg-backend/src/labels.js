// Labels that will be generated embeddings
export const EMBEDDING_LABELS = [
  'Document',
  'Section',
  'Information',
  'Requirement',
  'Guidance',
  'Reference',
  'Definition',
  'Table',
  'Diagram'
];

export const EMBEDDING_LABEL_DESCRIPTIONS = [
  'Document - Title of the document.',
  'Section - Usually short text that divides the document into parts (headings, titles)',
  'Information - Explanatory text like introductions, forewords, background context, etc.',
  'Requirement - Mandatory stipulation; typically uses "must" or "shall"',
  'Guidance - Recommendations for fulfilling requirements; typically uses "should" or "may"',
  'Reference - Citation or title of a related document, standard, or external source',
  'Definition - Explanation of a term or concept',
  'Table - Caption or title of a table',
  'Diagram - Caption of any graphic content (e.g., diagram, figure, illustration, chart)'
];

// Grouping labels in plural to be line split when parsing into Graph
export const GROUPING_LABELS = [
  'References',
  'Definitions'
];
