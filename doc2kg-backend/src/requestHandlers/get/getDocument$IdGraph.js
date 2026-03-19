import { withNeo4j } from '../../dataProviders/Neo4j.js'

const getDocument$IdGraphLogic = async (req, res, neo4jSession) => {
  try {
    const { id: docId } = req.params

    const result = await neo4jSession.run(
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
    console.error('Error in getDocument$IdGraphLogic:', error)
    res.status(500).json({ error: 'Failed to retrieve document graph.' })
  }
}
export const getDocument$IdGraph = withNeo4j(getDocument$IdGraphLogic)

export const documentation = {
  method: 'GET',
  path: '/document/:id/graph',
  description: 'Retrieves the knowledge graph JSON object (nodes and edges) associated with the document.',
  params: ['id']
}