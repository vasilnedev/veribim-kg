import { withNeo4j } from '../../dataProviders/Neo4j.js'

const getDocument$IdLogic = async (req, res, neo4jSession) => {
  try {
    const { id: docId } = req.params

    const result = await neo4jSession.run(
      `MATCH (d:Document { doc_id: $docId }) RETURN d`,
      { docId }
    )

    if (result.records.length === 0) {
      return res.status(404).json({ error: `Document with ID '${docId}' not found.` })
    }

    const documentProperties = result.records[0].get('d').properties
    res.status(200).json(documentProperties)
  } catch (error) {
    console.error('Error in getDocument$IdLogic:', error)
    res.status(500).json({ error: 'Failed to retrieve document.' })
  }
}

export const getDocument$Id = withNeo4j(getDocument$IdLogic)

export const documentation = {
  method: 'GET',
  path: '/document/:id',
  description: 'Retrieves the document metadata in JSON format.',
  params: ['id']
}