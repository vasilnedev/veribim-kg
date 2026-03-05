import config from '../config.json' with { type: 'json' }
import { withNeo4j, getMinioClient, getObjectFromMinio } from './common.js'


const { BUCKET_NAME } = config

const documentGetHandlerLogic = async (req, res, session) => {
  try {
    const { id: docId } = req.params

    const result = await session.run(
      `MATCH (d:Document { doc_id: $docId }) RETURN d`,
      { docId }
    )

    if (result.records.length === 0) {
      return res.status(404).json({ error: `Document with ID '${docId}' not found.` })
    }

    const documentProperties = result.records[0].get('d').properties
    res.status(200).json(documentProperties)

  } catch (error) {
    console.error('Error in documentGetHandler:', error)
    res.status(500).json({ error: 'Failed to retrieve document.' })
  }
}
export const documentGetHandler = withNeo4j(documentGetHandlerLogic)

export const documentGetPlainTextHandler = async (req, res) => {
  const minioClient = getMinioClient()
  try {
    const { id: docId } = req.params
    const objectName = `${docId}.txt`

    const textContent = await getObjectFromMinio(minioClient, objectName, 'utf-8')

    if (textContent === null) {
      return res.status(404).json({ error: `Plain text for document ID '${docId}' not found.` })
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.status(200).send(textContent)

  } catch (error) {
    console.error('Error in documentGetPlainTextHandler:', error)
    res.status(500).json({ error: 'Failed to retrieve plain text.' })
  }
}

export const documentGetRangesHandler = async (req, res) => {
  const minioClient = getMinioClient()
  try {
    const { id: docId } = req.params
    const objectName = `${docId}.json`

    const rangesContent = await getObjectFromMinio(minioClient, objectName, 'utf-8')

    if (rangesContent === null) {
      return res.status(404).json({ error: `Ranges for document ID '${docId}' not found.` })
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.status(200).send(rangesContent)

  } catch (error) {
    console.error('Error in documentGetRangesHandler:', error)
    res.status(500).json({ error: 'Failed to retrieve ranges.' })
  }
}

const documentListHandlerLogic = async (req, res, session) => {
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
    console.error('Error in documentListHandler:', error)
    res.status(500).json({ error: 'Failed to retrieve document list.' })
  }
}
export const documentListHandler = withNeo4j(documentListHandlerLogic)

export const documentGetPdfHandler = async (req, res) => {
  const minioClient = getMinioClient()
  try {
    const { id: docId } = req.params
    const objectName = `${docId}.pdf`

    const dataStream = await minioClient.getObject(BUCKET_NAME, objectName)
    res.setHeader('Content-Type', 'application/pdf')
    dataStream.pipe(res)

  } catch (error) {
    console.error('Error in documentGetPdfHandler:', error)
    if (error.code === 'NoSuchKey') {
      return res.status(404).json({ error: `PDF for document ID '${req.params.id}' not found.` })
    }
    res.status(500).json({ error: 'Failed to retrieve PDF.' })
  }
}

export const documentGetPageImageHandler = async (req, res) => {
  const minioClient = getMinioClient()
  try {
    const { id: docId, page: pageNr } = req.params
    const objectName = `${docId}.${pageNr}.png`

    const dataStream = await minioClient.getObject(BUCKET_NAME, objectName)
    res.setHeader('Content-Type', 'image/png')
    dataStream.pipe(res)

  } catch (error) {
    console.error('Error in documentGetPageImageHandler:', error)
    if (error.code === 'NoSuchKey') {
      return res.status(404).json({ error: `Image for document ID '${req.params.id}' page '${req.params.page}' not found.` })
    }
    res.status(500).json({ error: 'Failed to retrieve page image.' })
  }
}

const documentGetGraphHandlerLogic = async (req, res, session) => {
  try {
    const { id: docId } = req.params

    const result = await session.run(
      `MATCH path = (d:Document {doc_id: $docId})-[:HAS*0..]->(n) RETURN path`,
      { docId }
    )

    if (result.records.length === 0) {
      return res.status(404).json({ error: `Document with ID '${docId}' not found.` })
    }

    const nodesMap = new Map()
    const edgesMap = new Map()

    result.records.forEach(record => {
      const path = record.get('path')

      // Process path segments for nodes and relationships
      path.segments.forEach(segment => {
        const startNode = segment.start
        const endNode = segment.end
        const rel = segment.relationship

        if (!nodesMap.has(startNode.identity.toString())) {
          nodesMap.set(startNode.identity.toString(), {
            id: startNode.identity.toString(),
            labels: startNode.labels,
            properties: startNode.properties
          })
        }
        if (!nodesMap.has(endNode.identity.toString())) {
          nodesMap.set(endNode.identity.toString(), {
            id: endNode.identity.toString(),
            labels: endNode.labels,
            properties: endNode.properties
          })
        }
        if (!edgesMap.has(rel.identity.toString())) {
          edgesMap.set(rel.identity.toString(), {
            id: rel.identity.toString(),
            type: rel.type,
            start: rel.start.toString(),
            end: rel.end.toString(),
            properties: rel.properties
          })
        }
      })

      // Handle path of length 0 (the document node itself)
      if (path.length === 0) {
        const node = path.start
        if (!nodesMap.has(node.identity.toString())) {
          nodesMap.set(node.identity.toString(), { id: node.identity.toString(), labels: node.labels, properties: node.properties })
        }
      }
    })

    res.status(200).json({ nodes: Array.from(nodesMap.values()), edges: Array.from(edgesMap.values()) })
  } catch (error) {
    console.error('Error in documentGetGraphHandler:', error)
    res.status(500).json({ error: 'Failed to retrieve document graph.' })
  }
}
export const documentGetGraphHandler = withNeo4j(documentGetGraphHandlerLogic)