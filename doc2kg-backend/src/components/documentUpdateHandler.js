import { Client as MinioClient } from 'minio'
import neo4j from 'neo4j-driver'
import axios from 'axios'
import config from '../config.json' with { type: 'json' }

const { MINIO_CONFIG, BUCKET_NAME, NEO4J_CONFIG, OLLAMA_EMBED_CONFIG } = config

export const documentUpdatePlainTextHandler = async (req, res) => {
  const minioClient = new MinioClient(MINIO_CONFIG)
  const driver = neo4j.driver(NEO4J_CONFIG.uri, neo4j.auth.basic(NEO4J_CONFIG.user, NEO4J_CONFIG.password))
  const session = driver.session()
  try {
    const { id: docId } = req.params

    // Check if the document exists in Neo4j to ensure we're updating a valid entry
    const result = await session.run(
      `MATCH (d:Document { doc_id: $docId }) RETURN d`,
      { docId }
    )
    if (result.records.length === 0) {
      return res.status(404).json({ error: `Document with ID '${docId}' not found.` })
    }

    // Update the plain text file in MinIO
    const size = parseInt(req.headers['content-length'], 10)

    await minioClient.putObject(BUCKET_NAME, `${docId}.txt`, req, size, {
      'Content-Type': 'text/plain; charset=utf-8'
    })

    res.status(200).json({ message: `Plain text for document ID '${docId}' updated successfully.` })
  } catch (error) {
    console.error('Error in documentUpdatePlainTextHandler:', error)
    res.status(500).json({ error: 'Failed to update plain text.' })
  } finally {
    await session.close()
    await driver.close()
  }
}

export const documentUpdateRangesHandler = async (req, res) => {
  const minioClient = new MinioClient(MINIO_CONFIG)
  const driver = neo4j.driver(NEO4J_CONFIG.uri, neo4j.auth.basic(NEO4J_CONFIG.user, NEO4J_CONFIG.password))
  const session = driver.session()
  try {
    const { id: docId } = req.params

    // Check if the document exists in Neo4j to ensure we're updating a valid entry
    const result = await session.run(
      `MATCH (d:Document { doc_id: $docId }) RETURN d`,
      { docId }
    )
    if (result.records.length === 0) {
      return res.status(404).json({ error: `Document with ID '${docId}' not found.` })
    }

    // Update the ranges file in MinIO
    const size = parseInt(req.headers['content-length'], 10)

    await minioClient.putObject(BUCKET_NAME, `${docId}.json`, req, size, {
      'Content-Type': 'text/plain; charset=utf-8'
    })

    res.status(200).json({ message: `Ranges for document ID '${docId}' updated successfully.` })
  } catch (error) {
    console.error('Error in documentUpdateRangesHandler:', error)
    res.status(500).json({ error: 'Failed to update ranges.' })
  } finally {
    await session.close()
    await driver.close()
  }
}

export const documentUpdateGraphHandler = async (req, res) => {
  const minioClient = new MinioClient(MINIO_CONFIG)
  const driver = neo4j.driver(NEO4J_CONFIG.uri, neo4j.auth.basic(NEO4J_CONFIG.user, NEO4J_CONFIG.password))
  const session = driver.session()
  try {
    const { id: docId } = req.params

    // Check if the document exists in Neo4j
    const result = await session.run(
      `MATCH (d:Document { doc_id: $docId }) RETURN d`,
      { docId }
    )
    if (result.records.length === 0) {
      return res.status(404).json({ error: `Document with ID '${docId}' not found.` })
    }

    // Read the plain text file from MinIO
    let plainText = ''
    try {
      const dataStream = await minioClient.getObject(BUCKET_NAME, `${docId}.txt`)
      const chunks = []
      for await (const chunk of dataStream) {
        chunks.push(chunk)
      }
      plainText = Buffer.concat(chunks).toString('utf-8')
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        return res.status(404).json({ error: `Plain text file for document ID '${docId}' not found in storage.` })
      }
      throw error // re-throw other minio errors
    }

    // Split text into blocks
    const blocks = plainText.split('\n\n').filter(block => block.trim().length > 0)

    if (blocks.length > 0) {
      // Helper to generate embedding
      const getEmbedding = async (text) => {
        const response = await axios.post(OLLAMA_EMBED_CONFIG.url, {
          model: OLLAMA_EMBED_CONFIG.model,
          input: text,
          stream: false
        })
        return response.data.embeddings[0] || []
      }

      // Clear existing Information nodes
      await session.run(`MATCH (d:Document { doc_id: $docId })-[r:HAS*]->(n) DELETE r, n`, { docId })

      // Update Document node with first block
      const firstBlock = blocks[0]
      const firstEmbedding = await getEmbedding(firstBlock)
      await session.run(
        `MATCH (d:Document { doc_id: $docId }) SET d.text = $text, d.embedding = $embedding`,
        { docId, text: firstBlock, embedding: firstEmbedding }
      )

      // Create Information nodes for remaining blocks
      for (let i = 1; i < blocks.length; i++) {
        const blockText = blocks[i]
        const blockEmbedding = await getEmbedding(blockText)
        await session.run(
          `MATCH (d:Document { doc_id: $docId }) CREATE (d)-[:HAS]->(i:Information { text: $text, embedding: $embedding })`,
          { docId, text: blockText, embedding: blockEmbedding }
        )
      }
    }

    res.status(200).json({ message: `Graph for document ID '${docId}' updated successfully.` })
  } catch (error) {
    console.error('Error in documentUpdateGraphHandler:', error)
    res.status(500).json({ error: 'Failed to update graph from plain text.' })
  } finally {
    await session.close()
    await driver.close()
  }
}