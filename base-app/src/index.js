import express from 'express'
import cors from 'cors'
import http from 'http'
import { createProxyMiddleware } from 'http-proxy-middleware'

/* 
  This is a simple reverse proxy server that forwards requests to multiple micro-services within a Docker Compose VLAN to enable a common gateway access to the following services:
  - doc2kg-backend
  - doc2kg-frontend (with WebSocket support)
  - ifc2kg-backend
  - ifc2kg-frontend (with WebSocket support)
  - rag-backend
  - rag-frontend (with WebSocket support)
*/

const app = express()
const port = 80 // Run on the standard http port

// Enable CORS for all routes
app.use(cors())

// Define a router to dynamically select the target
const router = (req) => {
  if (req.url.startsWith('/doc2kg-backend')) return 'http://doc2kg-backend'
  if (req.url.startsWith('/doc2kg-frontend')) return 'http://doc2kg-frontend'
  if (req.url.startsWith('/ifc2kg-backend')) return 'http://ifc2kg-backend'
  if (req.url.startsWith('/ifc2kg-frontend')) return 'http://ifc2kg-frontend'
  if (req.url.startsWith('/rag-backend')) return 'http://rag-backend'
  if (req.url.startsWith('/rag-frontend')) return 'http://rag-frontend'
}

// Create a single, dynamic proxy middleware
const apiProxy = createProxyMiddleware({
  router: router,
  ws: true, // Enable WebSocket proxy
  changeOrigin: true,
  pathRewrite: {
    // Rewrite paths for all services
    '^/doc2kg-backend': '',
    '^/ifc2kg-backend': '',
    '^/rag-backend': '',
    // Vite frontends expect the base path, so we don't rewrite them.
    // The request to '/doc2kg-frontend/...' will be proxied to 'http://doc2kg-frontend/doc2kg-frontend/...'
  }
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
