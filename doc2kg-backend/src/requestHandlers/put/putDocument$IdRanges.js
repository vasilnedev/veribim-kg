import { withNeo4j, documentExists } from '../../dataProviders/dataProviderNeo4j.js'
import { getMinioClient, putObjectInMinio } from '../../dataProviders/dataProviderMinIO.js'

const putDocument$IdRangesLogic = async (req, res, neo4jSession) => {
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
    const rangesContent = Buffer.concat(chunks).toString('utf-8')
    const rangesObject = JSON.parse(rangesContent)

    // Update the ranges file in MinIO
    const minioClient = getMinioClient()
    await putObjectInMinio(minioClient, `${docId}.json`, rangesObject, 'json')

    res.status(200).json({ message: `Ranges for document ID '${docId}' updated successfully.` })
  } catch (error) {
    console.error('Error in putDocument$IdRanges:', error)
    res.status(500).json({ error: 'Failed to update ranges.' })
  }
}
export const putDocument$IdRanges = withNeo4j(putDocument$IdRangesLogic)