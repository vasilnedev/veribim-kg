import { withNeo4j, getMinioClient, documentExists } from './common.js'
import config from '../config.json' with { type: 'json' }

const { BUCKET_NAME } = config

const documentDeleteHandlerLogic = async (req, res, session) => {
  try {
    const { id: docId } = req.params

    // Check if the document exists in Neo4j to ensure we're deleting a valid entry
    if (!await documentExists(session, docId)) {
      return res.status(404).json({ error: `Document with ID '${docId}' not found.` })
    }

    // Delete the document and all its related nodes from Neo4j
    await session.run(
      `MATCH (d:Document { doc_id: $docId })
       OPTIONAL MATCH (d)-[:HAS*]->(n)
       DETACH DELETE d, n`,
      { docId }
    )

    // Delete all associated files from MinIO
    const minioClient = getMinioClient()
    const objectsStream = minioClient.listObjects(BUCKET_NAME, docId, true)
    const objectNames = []
    for await (const obj of objectsStream) {
      objectNames.push(obj.name)
    }

    if (objectNames.length > 0) {
      await minioClient.removeObjects(BUCKET_NAME, objectNames)
    }

    res.status(200).json({ message: `Document with ID '${docId}' and all associated data deleted successfully.` })
  } catch (error) {
    console.error('Error in documentDeleteHandler:', error)
    res.status(500).json({ error: 'Failed to delete document.' })
  }
}

export const documentDeleteHandler = withNeo4j(documentDeleteHandlerLogic)