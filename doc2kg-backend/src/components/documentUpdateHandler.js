import config from '../config.json' with { type: 'json' }
import { writeFile, rm, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import util from 'util'
import { textToGraph } from '../text2graph/text2graphJSON.js'
import { withNeo4j, getMinioClient, getObjectFromMinio, documentExists } from './common.js'
import { graphQueue } from '../graphQueues/graphQueue.js'


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

const documentUpdateGraphTestHandlerLogic = async (req, res, session) => {
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
    console.error('Error in documentUpdateGraphTestHandler:', error)
    res.status(500).json({ error: 'Failed to update graph test.' })
  }
}
export const documentUpdateGraphTestHandler = withNeo4j(documentUpdateGraphTestHandlerLogic)

export const documentUpdateGraphGenerateHandler = async (req, res) => {
  try {
    const { id: docId } = req.params
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'A userId is required to start a graph generate job.' })
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
