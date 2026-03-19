import { getMinioClient, getObjectStreamFromMinio } from '../../dataProviders/MinIO.js'

export const getDocument$IdPdf = async (req, res) => {
  const minioClient = getMinioClient()
  try {
    const { id: docId } = req.params
    const objectName = `${docId}.pdf`

    const dataStream = await getObjectStreamFromMinio(minioClient, objectName)
    
    if (!dataStream) {
      return res.status(404).json({ error: `PDF for document ID '${docId}' not found.` })
    }

    res.setHeader('Content-Type', 'application/pdf')
    dataStream.pipe(res)

  } catch (error) {
    console.error('Error in getDocument$IdPdf:', error)
    res.status(500).json({ error: 'Failed to retrieve PDF.' })
  }
}

export const documentation = {
  method: 'GET',
  path: '/document/:id/pdf',
  description: 'Streams the original PDF file of the document.',
  params: ['id']
}