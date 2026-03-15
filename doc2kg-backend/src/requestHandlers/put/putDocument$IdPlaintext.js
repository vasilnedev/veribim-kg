import { withNeo4j, documentExists } from '../../dataProviders/dataProviderNeo4j.js'
import { getMinioClient, putObjectInMinio } from '../../dataProviders/dataProviderMinIO.js'
import { Buffer } from 'buffer'

const putDocument$IdPlaintextLogic = async (req, res, neo4jSession) => {
  try {
    const { id: docId } = req.params

    // Check if the document exists in Neo4j to ensure we're updating a valid entry
    if (!await documentExists(neo4jSession, docId)) {
      return res.status(404).json({ error: `Document with ID '${docId}' not found.` })
    }

    // Buffer the request stream to get the content
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    const textContent = Buffer.concat(chunks).toString('utf-8')

    // Update the plain text file in MinIO
    const minioClient = getMinioClient()
    await putObjectInMinio(minioClient, `${docId}.txt`, textContent, 'txt')

    res.status(200).json({ message: `Plain text for document ID '${docId}' updated successfully.` })
  } catch (error) {
    console.error('Error in putDocument$IdPlaintext:', error)
    res.status(500).json({ error: 'Failed to update plain text.' })
  }
}
export const putDocument$IdPlaintext = withNeo4j(putDocument$IdPlaintextLogic)

export const documentation = {
  method: 'PUT',
  path: '/document/:id/text',
  description: 'Updates the plain text content of a document.',
  params: ['id'],
  body: 'Raw text content'
}