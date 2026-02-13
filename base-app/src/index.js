import express from 'express'
import cors from 'cors'
import http from 'http'
import { createProxyMiddleware } from 'http-proxy-middleware'

/* 
  This is a simple reverse proxy server that forwards requests to multiple micro-services within a Docker Compose VLAN to enable a common gateway access to the following services:
  - doc2kg-backend
  - doc2kg-frontend (WebSocket required)
  - ifc2kg-backend
  - ifc2kg-frontend (WebSocket required)
  - rag-backend
  - rag-frontend (WebSocket required)
*/

const app = express()
const port = 80 // Run on the standard http port

// Enable CORS for all domains
app.use(cors())

// Log every received request
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`)
  next()
})

// Define a router to dynamically select the target
const routes = new Set([
  '/doc2kg-backend',
  '/doc2kg-frontend',
  '/ifc2kg-backend',
  '/ifc2kg-frontend',
  '/rag-backend',
  '/rag-frontend'
])
const router = req => {
  for (const route of routes) {
    if (req.url.startsWith( route )) return `http:/${ route }`
  }
  return null // No matching route
}

// Create a single, dynamic proxy middleware
const apiProxy = createProxyMiddleware({
  router,
  ws: true, // Enable WebSocket proxy
  changeOrigin: true
})

// Health check endpoint
app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  }
  res.status(200).json(healthCheck)
})

// Use the proxy middleware for all other requests
app.use('/', apiProxy)

// Error handling middleware
app.use((err,req,res,next) => {
  console.error('Error occurred:', err)
  res.status(500).json({ error: 'Internal Server Error' })
})

// Create HTTP server
const server = http.createServer(app)

// Start the server
server.listen(port, () => console.log(`Server running on port ${port} with WebSocket support`))
