import { writeFile, rm, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import util from 'util'
import { getMinioClient, getObjectFromMinio, putObjectInMinio } from '../../dataProviders/MinIO.js'

const execPromise = util.promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export const putDocument$IdExtracttext = async (req, res) => {
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
    const textScript = join(__dirname, '../../pdf_extraction/extract_text_regions.py')
    const { stdout } = await execPromise(`python3 ${textScript} ${tempPdfPath} ${tempRangesPath}`)
    const result = JSON.parse(stdout)

    if (!result.success) {
      throw new Error(result.error || 'Extraction failed')
    }

    // Update MinIO
    await putObjectInMinio(minioClient, `${docId}.txt`, result.text, 'txt')

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

export const documentation = {
  method: 'PUT',
  path: '/document/:id/extracttext',
  description: 'Triggers the extraction of text from the PDF based on defined ranges and updates the text file.',
  params: ['id']
}