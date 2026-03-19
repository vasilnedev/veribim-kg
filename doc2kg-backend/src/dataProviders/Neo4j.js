import neo4j from 'neo4j-driver'
import config from '../config.json' with { type: 'json' }

const { NEO4J_CONFIG } = config

/**
 * A higher-order function that wraps an Express handler with Neo4j session management.
 * It creates a driver and session, passes the session to the handler,
 * and ensures the session and driver are closed.
 * @param {function(req, res, session): Promise<void>} handler - The handler function to wrap.
 * @returns {function(req, res): Promise<void>} The wrapped Express handler.
 */
export const withNeo4j = (handler) => async (req, res) => {
  const driver = neo4j.driver(NEO4J_CONFIG.uri, neo4j.auth.basic(NEO4J_CONFIG.user, NEO4J_CONFIG.password))
  const neo4jSession = driver.session()
  try {
    await handler(req, res, neo4jSession)
  } catch (error) {
    console.error('Error in Neo4j-wrapped handler:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'An internal server error occurred.' })
    }
  } finally {
    await neo4jSession.close()
    await driver.close()
  }
}

/**
 * Checks if a document exists in Neo4j based on its document ID.
 * @param {neo4j.Session} session - The Neo4j session.
 * @param {string} docId - The document ID to check.
 * @returns {Promise<boolean>} True if the document exists, false otherwise.
 */
export const documentExists = async (neo4jSession, docId) => {
  const result = await neo4jSession.run('MATCH (d:Document { doc_id: $docId }) RETURN d', { docId })
  return result.records.length > 0
}