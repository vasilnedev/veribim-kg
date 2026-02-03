import express from 'express'
import multer from 'multer'
import { documentCreateHandler } from './components/documentCreateHandler.js'
import {
  documentGetHandler, 
  documentListHandler, 
  documentGetPlainTextHandler,
  documentGetRangesHandler, 
  documentGetPdfHandler,
  documentGetPageImageHandler
} from './components/documentGetHandler.js'
import { 
  documentUpdatePlainTextHandler,
  documentUpdateRangesHandler, 
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
app.put('/doc2kg-backend/document/:id/plaintext', documentUpdatePlainTextHandler)
app.put('/doc2kg-backend/document/:id/ranges', documentUpdateRangesHandler)
app.put('/doc2kg-backend/document/:id/graph', documentUpdateGraphHandler)
app.get('/doc2kg-backend/documents', documentListHandler)

app.use('/doc2kg-backend', (req, res) => {
  setTimeout(() => {
    res.status(200).send('Ready for development.')
  }, 2000)
})

// Error handling middleware
app.use((err,req,res,next) => {
  console.error('Error occurred:', err)
  res.status(500).json({ error: 'Internal Server Error' })
})

// Start the server
app.listen( port , () => console.log(`Server running on port ${port}`))