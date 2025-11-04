import express from 'express'
import cors from 'cors'
import http from 'http'
import { createProxyMiddleware } from 'http-proxy-middleware'

/* 
  This is a simple reverse proxy server that forwards requests to multiple micro-services within a VLAN to enable a common gateway access to the following services:
  - doc2kg-backend
  - doc2kg-frontend (with WebSocket support)
*/

const app = express()
const port = 80 // Run on the standard http port

// Enable CORS for all routes
app.use(cors())

// Proxy middleware for doc2kg-backend service
const doc2kgBackendProxy = createProxyMiddleware({
  target: 'http://veribim-kg-doc2kg-backend-1'
})

// Proxy middleware for doc2kg-frontend service
const doc2kgFrontendProxy = createProxyMiddleware({
  target: 'http://veribim-kg-doc2kg-frontend-1/doc2kg-frontend',
  ws: true, // Enable WebSocket proxy
  changeOrigin: true,
  pathRewrite: {
    '^/doc2kg-frontend': '' // replace the path prefix
  }
})

// Use the proxy middlewares
app.use('/doc2kg-backend', doc2kgBackendProxy)
app.use('/doc2kg-frontend', doc2kgFrontendProxy)

// Error handling middleware
app.use((err,req,res,next) => {
  console.error('Error occurred:', err)
  res.status(500).json({ error: 'Internal Server Error' })
})

// Health check endpoint
app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  }
  res.status(200).json(healthCheck)
})

// Main route redirect to /health
app.get('/', (req, res) => {
  res.redirect('/health')
})

// Error handling middleware
app.use((err,req,res,next) => {
  console.error('Error occurred:', err)
  res.status(500).json({ error: 'Internal Server Error' })
})

// Create HTTP server
const server = http.createServer(app)

// Handle WebSocket upgrades
server.on('upgrade', function (req, socket, head) {
  if (req.url.startsWith('/doc2kg-frontend')) {
    doc2kgFrontendProxy.upgrade(req, socket, head)
  }
})

// Start the server
server.listen(port, () => console.log(`Server running on port ${port} with WebSocket support`))
