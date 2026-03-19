import { getMinioClient, getObjectStreamFromMinio } from '../../dataProviders/MinIO.js'

export const getDocument$IdPage$Page = async (req, res) => {
  const minioClient = getMinioClient()
  try {
    const { id: docId, page: pageNr } = req.params
    const objectName = `${docId}.${pageNr}.png`

    const dataStream = await getObjectStreamFromMinio(minioClient, objectName)
    
    if (!dataStream) {
      return res.status(404).json({ error: `Image for document ID '${docId}' page '${pageNr}' not found.` })
    }

    res.setHeader('Content-Type', 'image/png')
    dataStream.pipe(res)

  } catch (error) {
    console.error('Error in getDocument$IdPage$Page:', error)
    res.status(500).json({ error: 'Failed to retrieve page image.' })
  }
}

export const documentation = {
  method: 'GET',
  path: '/document/:id/page/:page',
  description: 'Retrieves the image (PNG) of a specific page of a document.',
  params: ['id', 'page']
}