import neo4j from 'neo4j-driver'
import { Client as MinioClient } from 'minio'
import config from '../config.json' with { type: 'json' }
import { Buffer } from 'buffer'

const { NEO4J_CONFIG, MINIO_CONFIG, BUCKET_NAME } = config

/**
 * Creates and returns a new MinIO client instance.
 * @returns {MinioClient} A Minio client.
 */
export const getMinioClient = () => new MinioClient(MINIO_CONFIG)

/**
 * A higher-order function that wraps an Express handler with Neo4j session management.
 * It creates a driver and session, passes the session to the handler,
 * and ensures the session and driver are closed.
 * @param {function(req, res, session): Promise<void>} handler - The handler function to wrap.
 * @returns {function(req, res): Promise<void>} The wrapped Express handler.
 */
export const withNeo4j = (handler) => async (req, res) => {
  const driver = neo4j.driver(NEO4J_CONFIG.uri, neo4j.auth.basic(NEO4J_CONFIG.user, NEO4J_CONFIG.password))
  const session = driver.session()
  try {
    await handler(req, res, session)
  } catch (error) {
    console.error('Error in Neo4j-wrapped handler:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'An internal server error occurred.' })
    }
  } finally {
    await session.close()
    await driver.close()
  }
}

/**
 * Retrieves an object from MinIO and returns it as a buffer or string.
 * @param {MinioClient} minioClient - The MinIO client.
 * @param {string} objectName - The name of the object to retrieve.
 * @param {string|null} [encoding=null] - The encoding to use for converting buffer to string. If null, returns a Buffer.
 * @returns {Promise<Buffer|string|null>} The object content, or null if not found.
 */
export const getObjectFromMinio = async (minioClient, objectName, encoding = null) => {
  try {
    const dataStream = await minioClient.getObject(BUCKET_NAME, objectName)
    const chunks = []
    for await (const chunk of dataStream) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)
    return encoding ? buffer.toString(encoding) : buffer
  } catch (error) {
    if (error.code === 'NoSuchKey') {
      return null
    }
    throw error
  }
}

export const documentExists = async (session, docId) => {
  const result = await session.run('MATCH (d:Document { doc_id: $docId }) RETURN d', { docId })
  return result.records.length > 0
}