import { textToGraphJSON } from '../../text2graph/text2graphJSON.js'
import { getMinioClient, getObjectFromMinio } from '../../dataProviders/dataProviderMinIO.js'

export const putDocument$IdGraphtest = async (req, res) => {
  try {
    const { id: docId } = req.params

    const minioClient = getMinioClient()
    const textContent = await getObjectFromMinio(minioClient, `${docId}.txt`, 'utf-8')
    if (textContent === null) {
      return res.status(404).json({ error: `Text file for document ID '${docId}' not found.` })
    }

    const graph = await textToGraphJSON(textContent, { createEmbeddings: false })

    if (graph.errors) {
      return res.status(400).json({ error: 'Graph generation failed', messages: graph.error_messages })
    }

    res.json(graph)

  } catch (error) {
    console.error('Error in putDocument$IdGraphtest:', error)
    res.status(500).json({ error: 'Failed to update graph test.' })
  }
}

export const documentation = {
  method: 'PUT',
  path: '/document/:id/graphtest',
  description: 'Test graph configuration from text and returns it immediately. Embeddings are not generated.',
  params: ['id']
}