import { withNeo4j } from '../../dataProviders/Neo4j.js'

const getDocumentsLogic = async (req, res, session) => {
  try {
    const result = await session.run(
      `MATCH (d:Document) RETURN d.doc_id as doc_id, d.sourceUrl as sourceUrl, d.text as text, d.pages as pages`
    )

    const documents = result.records.map(record => ({
      doc_id: record.get('doc_id'),
      sourceUrl: record.get('sourceUrl'),
      text: record.get('text'),
      pages: record.get('pages')
    }))

    res.status(200).json(documents)

  } catch (error) {
    console.error('Error in getDocumentsLogic:', error)
    res.status(500).json({ error: 'Failed to retrieve document list.' })
  }
}
export const getDocuments = withNeo4j(getDocumentsLogic)

export const documentation = {
  method: 'GET',
  path: '/documents',
  description: 'Retrieves a list of all documents with metadata.',
  params: null
}