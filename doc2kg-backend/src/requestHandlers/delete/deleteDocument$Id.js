import { withNeo4j, documentExists } from '../../dataProviders/dataProviderNeo4j.js'
import { getMinioClient, deleteObjectsFromMinio } from '../../dataProviders/dataProviderMinIO.js'

const deleteDocument$IdLogic = async (req, res, neo4jSession) => {
  try {
    const { id: docId } = req.params

    // Check if the document exists in Neo4j to ensure we're deleting a valid entry
    if (!await documentExists(neo4jSession, docId)) {
      return res.status(404).json({ error: `Document with ID '${docId}' not found.` })
    }

    // Delete the document and all its related nodes from Neo4j
    await neo4jSession.run(
      `MATCH (d:Document { doc_id: $docId })
       OPTIONAL MATCH (d)-[:HAS*]->(n)
       DETACH DELETE d, n`,
      { docId }
    )

    // Delete all associated files from MinIO
    const minioClient = getMinioClient()
    await deleteObjectsFromMinio(minioClient, docId)

    res.status(200).json({ message: `Document with ID '${docId}' and all associated data deleted successfully.` })
  } catch (error) {
    console.error('Error in deleteDocument$IdLogic:', error)
    res.status(500).json({ error: 'Failed to delete document.' })
  }
}

export const deleteDocument$Id = withNeo4j(deleteDocument$IdLogic)

export const documentation = {
  method: 'DELETE',
  path: '/document/:id',
  description: 'Deletes a document and all associated resources (Neo4j nodes, MinIO files).',
  params: ['id']
}