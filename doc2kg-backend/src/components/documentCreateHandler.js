import crypto from 'crypto'
import axios from 'axios'
import config from '../config.json' with { type: 'json' }
import { writeFile, readFile, rm, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import util from 'util'
import { withNeo4j, getMinioClient, documentExists } from './common.js'


const execPromise = util.promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// A function for generating a unique document id based on the file content
const generateShortId = (buffer) => {
  return crypto.createHash('sha256')
    .update(buffer)
    .digest('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
}

// Destructure config
const { 
  MINIO_CONFIG,
  BUCKET_NAME,
  OLLAMA_GENERATE_CONFIG, 
  OLLAMA_EMBED_CONFIG
} = config

// A constant for initial text extraction when a new document is created
const initialRanges = {
  "1":[[0.05,0.05,0.90,0.90]]
}

const documentCreateHandlerLogic = async (req, res, session) => {
  try {

    // Handle file upload and URL
    let pdfBuffer = req.file ?  req.file.buffer : null
    let sourceUrl = req.body && req.body.url ?  req.body.url : null

    // Download PDF from URL only if not submitted
    if( !pdfBuffer && sourceUrl ){
      const response = await axios.get(sourceUrl, { responseType: 'arraybuffer' })
      pdfBuffer = Buffer.from(response.data)
    }
    
    // If PDF could not be read or not valid, return an error
    if( !pdfBuffer || pdfBuffer.slice(0, 5).toString() !== '%PDF-' ){
      return res.status(400).json({ error: 'Could not obtain a valid PDF file.' })
    }
 
    // Compute document ID from PDF hash
    const docId = generateShortId(pdfBuffer)

    // Check if already in the database
    if (await documentExists(session, docId)) {
      return res.status(400).json({ error: 'Document already exists.' }) 
    } 

    // Create temp directory and file for external processing in Python
    const tempDir = join('/tmp', docId)
    await mkdir(tempDir, { recursive: true })
    const tempPdfPath = join(tempDir, 'source.pdf')
    await writeFile(tempPdfPath, pdfBuffer)

    let plainText = ''
    let pageCount = 0

    try {
      // Extract text using external Python script
      const textScript = join(__dirname, '../pdf-extraction/extract_text_regions.py')
      const { stdout } = await execPromise(`python3 ${textScript} ${tempPdfPath} '${JSON.stringify(initialRanges)}'`)
      const textResult = JSON.parse(stdout)
      
      if (!textResult.success) {
        throw new Error(textResult.error || 'Text extraction failed')
      }
      plainText = textResult.text
      pageCount = textResult.pages
    } catch (error) {
      await rm(tempDir, { recursive: true, force: true })
      console.error('Text extraction error:', error)
      return res.status(500).json({ error: 'Failed to extract text' })
    }

    // Initialize MinIO client and upload files
    const minioClient = getMinioClient()

    // Ensure bucket exists
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME)
    if (!bucketExists) {
      await minioClient.makeBucket(BUCKET_NAME)
    }

    // Upload PDF, plain text and ranges json to MinIO
    await minioClient.putObject(BUCKET_NAME, `${docId}.pdf`, pdfBuffer, {
      'Content-Type': 'application/pdf'
    })
    await minioClient.putObject(BUCKET_NAME, `${docId}.txt`, Buffer.from(plainText), {
      'Content-Type': 'text/plain'
    })
    await minioClient.putObject(BUCKET_NAME, `${docId}.json`, Buffer.from(JSON.stringify(initialRanges)), {
      'Content-Type': 'text/plain'
    })

    // Extract and upload images
    const tempImagesDir = join(tempDir, 'images')
    
    try {
      const pythonScript = join(__dirname, '../pdf-extraction/extract_images.py')
      const { stdout } = await execPromise(`python3 ${pythonScript} ${tempPdfPath} ${tempImagesDir} ${docId}`)
      const result = JSON.parse(stdout)
      
      if (result.success) {
        for (const imageFile of result.images) {
          const imagePath = join(tempImagesDir, imageFile)
          const imageBuffer = await readFile(imagePath)
          await minioClient.putObject(BUCKET_NAME, imageFile, imageBuffer, {
            'Content-Type': 'image/png'
          })
        }
      }
    } catch (error) {
      console.error('Image extraction error:', error)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }

    // Generate embedding from plain text using LLM 
    const embeddingResponse = await axios.post(OLLAMA_EMBED_CONFIG.url, {
      model: OLLAMA_EMBED_CONFIG.model,
      input: plainText,
      stream: false
    })
    const embedding = embeddingResponse.data.embeddings[0] || []

    // Create Document node in Neo4j
    await session.run(
      `CREATE (d:Document {
        doc_id: $docId,
        text: $text,
        embedding: $embedding,
        sourceUrl: $sourceUrl,
        pages: $pages
      })`,
      {
        docId,
        text: plainText, // Store text extracted as per the initial regions
        embedding,
        sourceUrl,
        pages: pageCount
      }
    )

    // Return success response
    res.status(201).json({
      id: docId,
      message: 'Document created successfully'
    });

  } 
  catch (error) {
    console.error('Error in documentCreateHandler:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
}

export const documentCreateHandler = withNeo4j(documentCreateHandlerLogic)