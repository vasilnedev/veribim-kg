import { getMinioClient, getObjectFromMinio } from '../../dataProviders/dataProviderMinIO.js'

export const getDocument$IdPlaintext = async (req, res) => {
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
    console.error('Error in getDocument$IdPlaintext:', error)
    res.status(500).json({ error: 'Failed to retrieve plain text.' })
  }
}