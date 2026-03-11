import express from 'express'
import multer from 'multer'
import http from 'http'
import { initSocket } from './socketServer.js'
import { documentCreateHandler } from './components/documentCreateHandler.js'
import { documentDeleteHandler } from './components/documentDeleteHandler.js'
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
  documentUpdateGraphTestHandler,
  documentUpdateGraphGenerateHandler
} from './components/documentUpdateHandler.js'

const app = express()
const server = http.createServer(app)
initSocket(server)

const port = 80 // Run on the standard http port

// Middleware
app.use(express.json())
const upload = multer()

// Routes
app.post('/doc2kg-backend/document', upload.single('pdf'), documentCreateHandler)
app.delete('/doc2kg-backend/document/:id', documentDeleteHandler)
app.get('/doc2kg-backend/document/:id', documentGetHandler)
app.get('/doc2kg-backend/document/:id/plaintext', documentGetPlainTextHandler)
app.get('/doc2kg-backend/document/:id/ranges', documentGetRangesHandler)
app.get('/doc2kg-backend/document/:id/pdf', documentGetPdfHandler)
app.get('/doc2kg-backend/document/:id/page/:page', documentGetPageImageHandler)
app.get('/doc2kg-backend/document/:id/graph', documentGetGraphHandler)
app.put('/doc2kg-backend/document/:id/extract', documentExtractTextHandler)
app.put('/doc2kg-backend/document/:id/plaintext', documentUpdatePlainTextHandler)
app.put('/doc2kg-backend/document/:id/ranges', documentUpdateRangesHandler)
app.put('/doc2kg-backend/document/:id/graphtest', documentUpdateGraphTestHandler)
app.put('/doc2kg-backend/document/:id/graphgenerate', documentUpdateGraphGenerateHandler)
app.put('/doc2kg-backend/document/:id/asyncgraph', documentUpdateGraphGenerateHandler)
app.get('/doc2kg-backend/documents', documentListHandler)

app.use('/doc2kg-backend', (req, res) => {
  res.status(200).json([
    { method: 'POST', path: '/doc2kg-backend/document', description: 'Create a new document. Accepts two inputs within the request body: 1. file (PDF document); and 2. url. The url is used to download the file if no file attached; however, the url is always stored as source reference.' },
    { method: 'GET', path: '/doc2kg-backend/document/:id', description: 'Get document details.' },
    { method: 'DELETE', path: '/doc2kg-backend/document/:id', description: 'Delete a document and all its associated files and graph data.' },
    { method: 'GET', path: '/doc2kg-backend/document/:id/plaintext', description: 'Get document plain text.' },
    { method: 'GET', path: '/doc2kg-backend/document/:id/ranges', description: 'Get document ranges.' },
    { method: 'GET', path: '/doc2kg-backend/document/:id/pdf', description: 'Get document PDF.' },
    { method: 'GET', path: '/doc2kg-backend/document/:id/page/:page', description: 'Get document page image.' },
    { method: 'GET', path: '/doc2kg-backend/document/:id/graph', description: 'Get document graph JSON.' },
    { method: 'PUT', path: '/doc2kg-backend/document/:id/extract', description: 'Triggers extracting text from PDF document and ranges saved on the server.' },
    { method: 'PUT', path: '/doc2kg-backend/document/:id/plaintext', description: 'Update document plain text from the request body.' },
    { method: 'PUT', path: '/doc2kg-backend/document/:id/ranges', description: 'Update document ranges from the request body.' },
    { method: 'PUT', path: '/doc2kg-backend/document/:id/graphtest', description: 'Triggers graph generation test from the saved plain text.' },
    { method: 'PUT', path: '/doc2kg-backend/document/:id/graphgenerate', description: 'Triggers graph generation as a background job. Returns a job ID.' },
    { method: 'GET', path: '/doc2kg-backend/documents', description: 'List all documents' }
  ])
})

// Error handling middleware
app.use((err,req,res,next) => {
  console.error('Error occurred:', err)
  res.status(500).json({ error: 'Internal Server Error' })
})

// Start the server
server.listen( port , () => console.log(`Server running on port ${port}`))