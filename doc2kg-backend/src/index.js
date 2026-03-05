import express from 'express'
import multer from 'multer'
import { documentCreateHandler } from './components/documentCreateHandler.js'
import {
  documentGetHandler, 
  documentListHandler, 
  documentGetPlainTextHandler,
  documentGetRangesHandler, 
  documentGetPdfHandler,
  documentGetPageImageHandler,
  documentGetGraphHandler
} from './components/documentGetHandler.js'
import { 
  documentUpdatePlainTextHandler,
  documentUpdateRangesHandler, 
  documentExtractTextHandler,
  documentUpdateGraphHandler
} from './components/documentUpdateHandler.js'

const app = express()

const port = 80 // Run on the standard http port

// Middleware
app.use(express.json())
const upload = multer()

// Routes
app.post('/doc2kg-backend/document', upload.single('pdf'), documentCreateHandler)
app.get('/doc2kg-backend/document/:id', documentGetHandler)
app.get('/doc2kg-backend/document/:id/plaintext', documentGetPlainTextHandler)
app.get('/doc2kg-backend/document/:id/ranges', documentGetRangesHandler)
app.get('/doc2kg-backend/document/:id/pdf', documentGetPdfHandler)
app.get('/doc2kg-backend/document/:id/page/:page', documentGetPageImageHandler)
app.get('/doc2kg-backend/document/:id/graph', documentGetGraphHandler)
app.put('/doc2kg-backend/document/:id/extract', documentExtractTextHandler)
app.put('/doc2kg-backend/document/:id/plaintext', documentUpdatePlainTextHandler)
app.put('/doc2kg-backend/document/:id/ranges', documentUpdateRangesHandler)
app.put('/doc2kg-backend/document/:id/graph', documentUpdateGraphHandler)
app.get('/doc2kg-backend/documents', documentListHandler)

app.use('/doc2kg-backend', (req, res) => {
  res.status(200).json([
    { method: 'POST', path: '/doc2kg-backend/document', description: 'Create a new document. Accepts two inputs within the request body: 1. file (PDF document); and 2. url. The url is used to download the file if no file attached; however, the url is always stored as source reference.' },
    { method: 'GET', path: '/doc2kg-backend/document/:id', description: 'Get document details.' },
    { method: 'GET', path: '/doc2kg-backend/document/:id/plaintext', description: 'Get document plain text.' },
    { method: 'GET', path: '/doc2kg-backend/document/:id/ranges', description: 'Get document ranges.' },
    { method: 'GET', path: '/doc2kg-backend/document/:id/pdf', description: 'Get document PDF.' },
    { method: 'GET', path: '/doc2kg-backend/document/:id/page/:page', description: 'Get document page image.' },
    { method: 'GET', path: '/doc2kg-backend/document/:id/graph', description: 'Get document graph JSON.' },
    { method: 'PUT', path: '/doc2kg-backend/document/:id/extract', description: 'Triggers extracting text from PDF document and ranges saved on the server.' },
    { method: 'PUT', path: '/doc2kg-backend/document/:id/plaintext', description: 'Update document plain text from the request body.' },
    { method: 'PUT', path: '/doc2kg-backend/document/:id/ranges', description: 'Update document ranges from the request body.' },
    { method: 'PUT', path: '/doc2kg-backend/document/:id/graph', description: 'Triggers graph generation from the saved plain text. Accepts options within a JSON object in the request body like {"importInDB":true,"createEmbeddings":true}' },
    { method: 'GET', path: '/doc2kg-backend/documents', description: 'List all documents' }
  ])
})

// Error handling middleware
app.use((err,req,res,next) => {
  console.error('Error occurred:', err)
  res.status(500).json({ error: 'Internal Server Error' })
})

// Start the server
app.listen( port , () => console.log(`Server running on port ${port}`))