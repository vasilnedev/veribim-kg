import { textToGraph } from '../../text2graph/text2graphJSON.js'
import { withNeo4j } from '../../dataProviders/dataProviderNeo4j.js'
import { getMinioClient, getObjectFromMinio } from '../../dataProviders/dataProviderMinIO.js'

const putDocument$IdGraphtestLogic = async (req, res, session) => {
  try {
    const { id: docId } = req.params

    const minioClient = getMinioClient()
    const textContent = await getObjectFromMinio(minioClient, `${docId}.txt`, 'utf-8')
    if (textContent === null) {
      return res.status(404).json({ error: `Text file for document ID '${docId}' not found.` })
    }

    const graph = await textToGraph(textContent, { createEmbeddings: false })

    if (graph.errors) {
      return res.status(400).json({ error: 'Graph generation failed', messages: graph.error_messages })
    }

    res.json(graph)

  } catch (error) {
    console.error('Error in putDocument$IdGraphtest:', error)
    res.status(500).json({ error: 'Failed to update graph test.' })
  }
}
export const putDocument$IdGraphtest = withNeo4j(putDocument$IdGraphtestLogic)