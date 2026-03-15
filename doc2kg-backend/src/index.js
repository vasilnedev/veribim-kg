import express from 'express'
import http from 'http'
import { initSocket } from './socketServer.js'
import { setupRoutes } from './routes.js'

// Create http server with socket.io service
const app = express()
const server = http.createServer(app)
initSocket(server)

const port = 80 // Run on the standard http port

// Middleware
app.use(express.json())

// Routes
await setupRoutes(app)

// Error handling middleware
app.use((err,req,res,next) => {
  console.error('Error occurred:', err)
  res.status(500).json({ error: 'Internal Server Error' })
})

// Start the server
server.listen( port , () => console.log(`Server running on port ${port}`))