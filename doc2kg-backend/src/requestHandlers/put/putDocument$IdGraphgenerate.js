import { graphQueue } from '../../bullmqQueues/graphQueue.js'
import { withNeo4j, documentExists } from '../../dataProviders/dataProviderNeo4j.js'

const putDocument$IdGraphgenerateLogic = async (req, res, neo4jSession) => {
  try {
    const { id: docId } = req.params
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'A userId is required to start a graph generate job.' })
    }

    if (!await documentExists(neo4jSession, docId)) {
      return res.status(404).json({ error: `Document with ID '${docId}' not found.` })
    }

    const job = await graphQueue.add('graph-generate-job', {
      docId,
      userId
    })

    res.status(202).json({ jobId: job.id })
  } catch (error) {
    console.error('Failed to create graph job:', error)
    res.status(500).json({ error: 'Failed to queue the job.' })
  }
}
export const putDocument$IdGraphgenerate = withNeo4j(putDocument$IdGraphgenerateLogic)