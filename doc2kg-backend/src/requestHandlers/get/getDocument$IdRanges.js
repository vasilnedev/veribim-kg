import { getMinioClient, getObjectFromMinio } from '../../dataProviders/dataProviderMinIO.js'

export const getDocument$IdRanges = async (req, res) => {
  const minioClient = getMinioClient()
  try {
    const { id: docId } = req.params
    const objectName = `${docId}.json`

    const rangesContent = await getObjectFromMinio(minioClient, objectName, 'utf-8')

    if (rangesContent === null) {
      return res.status(404).json({ error: `Ranges for document ID '${docId}' not found.` })
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.status(200).send(rangesContent)

  } catch (error) {
    console.error('Error in getDocument$IdRanges:', error)
    res.status(500).json({ error: 'Failed to retrieve ranges.' })
  }
}