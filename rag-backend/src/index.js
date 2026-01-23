import express from 'express'

const app = express()

const port = 80 // Run on the standard http port

// Main route 
app.use('/rag-backend', (req, res) => {
  setTimeout(() => {
    res.status(200).send('Ready for development.')
  }, 1000)
})

// Error handling middleware
app.use((err,req,res,next) => {
  console.error('Error occurred:', err)
  res.status(500).json({ error: 'Internal Server Error' })
})

// Start the server
app.listen( port , () => console.log(`Server running on port ${port}`))