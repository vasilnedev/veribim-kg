import express from 'express'
import multer from 'multer'
import { documentCreateHandler } from './components/documentCreateHandler.js'

const app = express()

const port = 80 // Run on the standard http port

// Middleware
app.use(express.json())
const upload = multer()

// Routes
app.post('/doc2kg-backend/document', upload.single('pdf'), documentCreateHandler)

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