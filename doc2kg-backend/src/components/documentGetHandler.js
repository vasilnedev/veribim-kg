import neo4j from 'neo4j-driver'
import { Client as MinioClient } from 'minio'
import config from '../config.json' with { type: 'json' }

const { NEO4J_CONFIG, MINIO_CONFIG, BUCKET_NAME } = config

export const documentGetHandler = async (req, res) => {
  const driver = neo4j.driver(NEO4J_CONFIG.uri, neo4j.auth.basic(NEO4J_CONFIG.user, NEO4J_CONFIG.password))
  const session = driver.session()
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
  } finally {
    await session.close()
    await driver.close()
  }
}

export const documentGetPlainTextHandler = async (req, res) => {
  const minioClient = new MinioClient(MINIO_CONFIG)
  try {
    const { id: docId } = req.params
    const objectName = `${docId}.txt`

    const dataStream = await minioClient.getObject(BUCKET_NAME, objectName)

    const chunks = []
    for await (const chunk of dataStream) {
      chunks.push(chunk)
    }

    const fileBuffer = Buffer.concat(chunks)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.status(200).send(fileBuffer.toString('utf-8'))

  } catch (error) {
    console.error('Error in documentGetPlainTextHandler:', error)
    if (error.code === 'NoSuchKey') {
      return res.status(404).json({ error: `Plain text for document ID '${req.params.id}' not found.` })
    }
    res.status(500).json({ error: 'Failed to retrieve plain text.' })
  }
}

export const documentGetRangesHandler = async (req, res) => {
  const minioClient = new MinioClient(MINIO_CONFIG)
  try {
    const { id: docId } = req.params
    const objectName = `${docId}.json`

    const dataStream = await minioClient.getObject(BUCKET_NAME, objectName)

    const chunks = []
    for await (const chunk of dataStream) {
      chunks.push(chunk)
    }

    const fileBuffer = Buffer.concat(chunks)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.status(200).send(fileBuffer.toString('utf-8'))

  } catch (error) {
    console.error('Error in documentGetRangesHandler:', error)
    if (error.code === 'NoSuchKey') {
      return res.status(404).json({ error: `Ranges for document ID '${req.params.id}' not found.` })
    }
    res.status(500).json({ error: 'Failed to retrieve ranges.' })
  }
}

export const documentListHandler = async (req, res) => {
  const driver = neo4j.driver(NEO4J_CONFIG.uri, neo4j.auth.basic(NEO4J_CONFIG.user, NEO4J_CONFIG.password))
  const session = driver.session()
  try {
    const result = await session.run(
      `MATCH (d:Document) RETURN d.doc_id as doc_id, d.url as url, d.text as text, d.pages as pages`
    )

    const documents = result.records.map(record => ({
      doc_id: record.get('doc_id'),
      url: record.get('url'),
      text: record.get('text'),
      pages: record.get('pages')
    }))

    res.status(200).json(documents)

  } catch (error) {
    console.error('Error in documentListHandler:', error)
    res.status(500).json({ error: 'Failed to retrieve document list.' })
  } finally {
    await session.close()
    await driver.close()
  }
}

export const documentGetPdfHandler = async (req, res) => {
  const minioClient = new MinioClient(MINIO_CONFIG)
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
  const minioClient = new MinioClient(MINIO_CONFIG)
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