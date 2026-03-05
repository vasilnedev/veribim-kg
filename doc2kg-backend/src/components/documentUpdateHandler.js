import config from '../config.json' with { type: 'json' }
import { writeFile, rm, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import util from 'util'
import { textToGraph } from './text2graphJSON.js'
import { withNeo4j, getMinioClient, getObjectFromMinio, documentExists } from './common.js'


const execPromise = util.promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const { BUCKET_NAME } = config

const documentUpdatePlainTextHandlerLogic = async (req, res, session) => {
  try {
    const { id: docId } = req.params

    // Check if the document exists in Neo4j to ensure we're updating a valid entry
    if (!await documentExists(session, docId)) {
      return res.status(404).json({ error: `Document with ID '${docId}' not found.` })
    }

    // Update the plain text file in MinIO
    const size = parseInt(req.headers['content-length'], 10)

    const minioClient = getMinioClient()
    await minioClient.putObject(BUCKET_NAME, `${docId}.txt`, req, size, {
      'Content-Type': 'text/plain; charset=utf-8'
    })

    res.status(200).json({ message: `Plain text for document ID '${docId}' updated successfully.` })
  } catch (error) {
    console.error('Error in documentUpdatePlainTextHandler:', error)
    res.status(500).json({ error: 'Failed to update plain text.' })
  }
}
export const documentUpdatePlainTextHandler = withNeo4j(documentUpdatePlainTextHandlerLogic)

const documentUpdateGraphHandlerLogic = async (req, res, session) => {
  try {
    const { id: docId } = req.params
    const options = (req.body && Object.keys(req.body).length > 0) ? req.body : { createEmbeddings: false, importInDB: false }

    // Read the <docId>.txt file from Minio
    const minioClient = getMinioClient()
    const textContent = await getObjectFromMinio(minioClient, `${docId}.txt`, 'utf-8')
    if (textContent === null) {
      return res.status(404).json({ error: `Text file for document ID '${docId}' not found.` })
    }

    // Run text2graph function
    const graph = await textToGraph(textContent, options)

    if (graph.errors) {
      return res.status(400).json({ error: 'Graph generation failed', messages: graph.error_messages })
    }

    if (options.importInDB) {
      // Check in Neo4j for (:Document) node
      if (!await documentExists(session, docId)) {
        return res.status(404).json({ error: `Document with ID '${docId}' not found.` })
      }

      // Delete recursively all the tree nodes related with [:HAS] relations
      await session.run(`
        MATCH (d:Document { doc_id: $docId })
        OPTIONAL MATCH (d)-[:HAS*]->(n)
        DETACH DELETE n
      `, { docId })

      // Update properties and insert new nodes
      const rootNode = graph.nodes.find(n => n.label === 'Document')
      if (!rootNode) {
          throw new Error('Generated graph does not contain a Document node')
      }
      
      // Update root node properties and set a temp_id for linking
      const { id: rootId, label: rootLabel, ...rootProps } = rootNode
      await session.run(`
          MATCH (d:Document { doc_id: $docId })
          SET d += $props, d.temp_id = $tempId
      `, { docId, props: rootProps, tempId: rootId })

      // Insert other nodes
      const otherNodes = graph.nodes.filter(n => n.label !== 'Document')
      
      // Batch insert by label
      const labels = [...new Set(otherNodes.map(n => n.label))]
      for (const label of labels) {
          const nodesToInsert = otherNodes.filter(n => n.label === label).map(n => {
              const { id, label: l, ...props } = n
              return { ...props, temp_id: id }
          })
          
          if (nodesToInsert.length > 0) {
              await session.run(`
                  UNWIND $batch AS row
                  CREATE (n:\`${label}\`)
                  SET n += row
              `, { batch: nodesToInsert })
          }
      }

      // Create relationships
      if (graph.links.length > 0) {
          await session.run(`
              UNWIND $links AS link
              MATCH (s), (t)
              WHERE s.temp_id = link.source AND t.temp_id = link.target
              MERGE (s)-[:HAS]->(t)
          `, { links: graph.links })
      }

      // Remove temp_id
      await session.run(`
          MATCH (d:Document { doc_id: $docId })
          OPTIONAL MATCH (d)-[:HAS*0..]->(n)
          REMOVE n.temp_id
      `, { docId })
        }

    res.json(graph)

  } catch (error) {
    console.error('Error in documentUpdateGraphHandler:', error)
    res.status(500).json({ error: 'Failed to update graph.' })
  }
}
export const documentUpdateGraphHandler = withNeo4j(documentUpdateGraphHandlerLogic)

export const documentExtractTextHandler = async (req, res) => {
  let tempDir = null
  const minioClient = getMinioClient()
  try {
    const { id: docId } = req.params
    tempDir = join('/tmp', `${docId}_extract`)
    await mkdir(tempDir, { recursive: true })
    const tempPdfPath = join(tempDir, 'source.pdf')
    const tempRangesPath = join(tempDir, 'ranges.json')

    // Get PDF
    const pdfBuffer = await getObjectFromMinio(minioClient, `${docId}.pdf`)
    if (!pdfBuffer) {
      return res.status(404).json({ error: `PDF for document ID '${docId}' not found.` })
    }
    await writeFile(tempPdfPath, pdfBuffer)

    // Get Ranges
    let rangesJson = await getObjectFromMinio(minioClient, `${docId}.json`, 'utf-8')
    if (rangesJson === null) {
      rangesJson = '{}' // Ranges might not exist, use default or empty
    }

    await writeFile(tempRangesPath, rangesJson)

    // Run script
    const textScript = join(__dirname, '../python/extract_text_regions.py')
    const { stdout } = await execPromise(`python3 ${textScript} ${tempPdfPath} ${tempRangesPath}`)
    const result = JSON.parse(stdout)

    if (!result.success) {
      throw new Error(result.error || 'Extraction failed')
    }

    // Update MinIO
    await minioClient.putObject(BUCKET_NAME, `${docId}.txt`, Buffer.from(result.text), {
      'Content-Type': 'text/plain; charset=utf-8'
    })

    res.json({ success: true, text: result.text })

  } catch (error) {
    console.error('Error extracting text:', error)
    res.status(500).json({ error: 'Failed to extract text' })
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}

const documentUpdateRangesHandlerLogic = async (req, res, session) => {
  try {
    const { id: docId } = req.params

    // Check if the document exists in Neo4j to ensure we're updating a valid entry
    if (!await documentExists(session, docId)) {
      return res.status(404).json({ error: `Document with ID '${docId}' not found.` })
    }

    // Update the ranges file in MinIO
    const size = parseInt(req.headers['content-length'], 10)

    const minioClient = getMinioClient()
    await minioClient.putObject(BUCKET_NAME, `${docId}.json`, req, size, {
      'Content-Type': 'text/plain; charset=utf-8'
    })

    res.status(200).json({ message: `Ranges for document ID '${docId}' updated successfully.` })
  } catch (error) {
    console.error('Error in documentUpdateRangesHandler:', error)
    res.status(500).json({ error: 'Failed to update ranges.' })
  }
}
export const documentUpdateRangesHandler = withNeo4j(documentUpdateRangesHandlerLogic)
